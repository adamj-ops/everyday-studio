/**
 * Everyday Studio — Prompt Test Harness
 *
 * Exercises the full two-tier Claude flow against the Vincent Ave kitchen
 * fixture so we can evaluate prompt + review quality BEFORE wiring it into
 * the Next.js app:
 *
 *   Stage 1 — Sonnet (operator)  → Gemini prompt
 *   Stage 2 — Opus  (reviewer)   → verdict on Sonnet's prompt
 *   Stage 3 — Opus  (reviewer)   → QA on a rendered image (if provided)
 *
 * Usage:
 *   1. .env.local has ANTHROPIC_API_KEY (loaded automatically).
 *   2. npm run test:prompts                          # default fixture (vincent-ave-kitchen)
 *      npm run test:prompts -- luxury-kitchen        # pick a fixture
 *      npm run test:prompts -- --image <path>        # run Stage 3 on a render
 *      npm run test:prompts -- vincent-ave-kitchen --image <path>
 *
 * Stage 2 is deliberately a no-apply display: we want to judge whether
 * Opus's prompt review adds signal or rubber-stamps Sonnet >90% of the time.
 * Don't auto-apply revisions in the harness — that's an app-logic decision
 * once we've validated the pattern.
 */

import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { RoomSpecSchema } from "../lib/specs/schema";
import {
  buildRenderPromptRequest,
  buildPromptReviewRequest,
  buildRenderReviewRequest,
  type RenderPromptOutput,
  type PromptReviewOutput,
  type RenderReviewOutput,
} from "../lib/claude/prompts";
import { DEFAULT_FIXTURE, FIXTURES, getFixture, type FixtureRecord } from "../test-fixtures/registry";

// Note: we import the Anthropic client *dynamically* inside main() so that
// loadEnvLocal() runs first. lib/claude/client.ts throws at module load if
// ANTHROPIC_API_KEY is missing, and ES imports hoist above top-level code —
// dynamic import is the cleanest way to sequence env loading before that.
type ClaudeClientModule = typeof import("../lib/claude/client");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

let claude: ClaudeClientModule;

function sniffImageMediaType(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString() === "RIFF" &&
    buf.slice(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 4 && buf.slice(0, 4).toString() === "GIF8") {
    return "image/gif";
  }
  return "image/jpeg";
}

function printDivider(title: string) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70) + "\n");
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseJsonFromClaude<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

interface HeuristicCheck {
  name: string;
  pass: boolean;
}

/**
 * Heuristic checks are two layers: structural (same across every fixture) plus
 * per-fixture material expectations. Adding a new fixture? Add a case to the
 * switch with the material tokens you expect to see in the prompt.
 */
function buildHeuristicChecks(fixture: FixtureRecord, prompt: string): HeuristicCheck[] {
  const structural: HeuristicCheck[] = [
    {
      name: `Prompt is at least 1500 chars (enough detail for Gemini, ${prompt.length} chars)`,
      pass: prompt.length >= 1500,
    },
    {
      name: `Prompt is under 6000 chars (advisory ceiling, ${prompt.length} chars)`,
      pass: prompt.length < 6000,
    },
    {
      name: "Prompt includes a PRESERVE FROM ORIGINAL section",
      pass: /preserve from original/i.test(prompt),
    },
    {
      name: "Prompt includes a REMOVE FROM ORIGINAL section",
      pass: /remove from original/i.test(prompt),
    },
    {
      name: "Prompt ends with the standard close line",
      pass: /return the final rendered image only\.?\s*$/i.test(prompt.trim()),
    },
  ];

  const perFixture: HeuristicCheck[] = [];
  switch (fixture.name) {
    case "vincent-ave-kitchen":
    case "vincent-ave-kitchen-with-refs":
      perFixture.push(
        { name: "names Alabaster paint color", pass: /alabaster/i.test(prompt) },
        { name: "names zellige backsplash", pass: /zellige/i.test(prompt) },
        {
          name: "specifies vertical stack pattern",
          pass: /vertical/i.test(prompt) && /stack/i.test(prompt),
        },
        { name: "names brass hardware/pendants", pass: /brass/i.test(prompt) },
        { name: "names white oak / LVP flooring", pass: /(white oak|lvp)/i.test(prompt) },
        { name: "specifies morning light", pass: /morning/i.test(prompt) },
      );
      if (fixture.name === "vincent-ave-kitchen-with-refs") {
        perFixture.push({
          name: "prompt includes a REFERENCE IMAGES section",
          pass: /reference images?:/i.test(prompt),
        });
      }
      break;
    case "vincent-ave-primary-bath":
      perFixture.push(
        { name: "names Alabaster vanity color", pass: /alabaster/i.test(prompt) },
        { name: "names zellige shower walls", pass: /zellige/i.test(prompt) },
        { name: "specifies hex floor tile", pass: /hex/i.test(prompt) },
        { name: "names matte black plumbing", pass: /matte black/i.test(prompt) },
        { name: "specifies walk-in glass shower", pass: /walk[- ]in|glass/i.test(prompt) },
      );
      break;
    case "luxury-kitchen":
      perFixture.push(
        { name: "names Calacatta marble", pass: /calacatta/i.test(prompt) },
        { name: "names unlacquered brass", pass: /unlacquered brass/i.test(prompt) },
        { name: "names Wolf range", pass: /wolf/i.test(prompt) },
        { name: "names Sub-Zero refrigerator", pass: /sub[- ]?zero/i.test(prompt) },
        { name: "names inset cabinetry", pass: /inset/i.test(prompt) },
        { name: "names White Dove paint", pass: /white dove/i.test(prompt) },
      );
      break;
    case "builder-bedroom":
      perFixture.push(
        { name: "names Agreeable Gray paint", pass: /agreeable gray/i.test(prompt) },
        { name: "names LVP flooring", pass: /lvp/i.test(prompt) },
        { name: "names flush mount light", pass: /flush mount/i.test(prompt) },
        { name: "does not invent brass/zellige/marble", pass: !/brass|zellige|marble/i.test(prompt) },
      );
      break;
  }

  return [...structural, ...perFixture];
}

async function testPromptGeneration(fixture: FixtureRecord): Promise<RenderPromptOutput> {
  printDivider(
    `STAGE 1: Sonnet generates the Gemini prompt (${claude.CLAUDE_OPERATOR_MODEL}) — fixture: ${fixture.name}`,
  );

  const parsed = RoomSpecSchema.safeParse(fixture.spec);
  if (!parsed.success) {
    console.error("❌ Spec failed Zod validation:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }
  console.log("✅ Spec validates against Zod schema\n");

  const { system, user } = buildRenderPromptRequest({
    spec: parsed.data,
    context: fixture.context,
    base_photo_description: fixture.basePhotoDescription,
    references: fixture.references,
  });

  console.log("→ Calling Sonnet for render prompt generation…\n");

  const response = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_OPERATOR_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = extractText(response);
  let output: RenderPromptOutput;
  try {
    output = parseJsonFromClaude<RenderPromptOutput>(text);
  } catch {
    console.error("❌ Sonnet did not return valid JSON:");
    console.error(text);
    process.exit(1);
  }

  console.log("📝 Generated prompt:");
  console.log(`  "${output.prompt.slice(0, 500)}${output.prompt.length > 500 ? "…" : ""}"`);
  console.log(`  (${output.prompt.length} chars total)\n`);

  console.log("💭 Notes:");
  console.log(`  ${output.notes}\n`);

  console.log("🔍 Heuristic quality checks:");
  const checks = buildHeuristicChecks(fixture, output.prompt);
  for (const c of checks) {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`\n  ${passCount}/${checks.length} checks passed`);

  fs.writeFileSync(
    path.join(__dirname, "..", "test-fixtures", `last-prompt-output-${fixture.name}.json`),
    JSON.stringify(output, null, 2),
  );

  return output;
}

async function testPromptReview(
  fixture: FixtureRecord,
  promptOutput: RenderPromptOutput,
): Promise<PromptReviewOutput> {
  printDivider(
    `STAGE 2: Opus reviews Sonnet's prompt (${claude.CLAUDE_REVIEWER_MODEL}) — fixture: ${fixture.name}`,
  );

  const { system, user } = buildPromptReviewRequest({
    spec: fixture.spec,
    context: fixture.context,
    base_photo_description: fixture.basePhotoDescription,
    references: fixture.references,
    generated_prompt: promptOutput.prompt,
  });

  console.log("→ Calling Opus for prompt QA review…\n");

  const response = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_REVIEWER_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = extractText(response);
  let review: PromptReviewOutput;
  try {
    review = parseJsonFromClaude<PromptReviewOutput>(text);
  } catch {
    console.error("❌ Opus did not return valid JSON:");
    console.error(text);
    process.exit(1);
  }

  const verdictIcon =
    review.verdict === "ship_it" ? "✅" : review.verdict === "revise" ? "✏️ " : "🔁";
  console.log(`${verdictIcon} Verdict: ${review.verdict.toUpperCase()}`);

  if (review.issues.length > 0) {
    console.log(`\n⚠️  Issues (${review.issues.length}):`);
    for (const issue of review.issues) {
      const sevIcon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
      console.log(`\n  ${sevIcon} [${issue.severity}] ${issue.concern}`);
      console.log(`     Suggestion: ${issue.suggestion}`);
    }
  } else {
    console.log("\n  No issues flagged.");
  }

  if (review.verdict === "revise" && review.revised_prompt) {
    console.log("\n✏️  Opus's revised prompt (preview):");
    console.log(
      `  "${review.revised_prompt.slice(0, 500)}${review.revised_prompt.length > 500 ? "…" : ""}"`,
    );
    console.log(`  (${review.revised_prompt.length} chars total)`);
    console.log(
      "\n  Note: harness does NOT auto-apply revisions. Review both prompts side by side and decide.",
    );
    fs.writeFileSync(
      path.join(__dirname, "..", "test-fixtures", `last-prompt-review-${fixture.name}.json`),
      JSON.stringify(review, null, 2),
    );
  }

  return review;
}

async function testRenderReview(fixture: FixtureRecord, imagePath: string) {
  printDivider(
    `STAGE 3: Opus QA on rendered image (${claude.CLAUDE_REVIEWER_MODEL}) — fixture: ${fixture.name}`,
  );

  if (!fs.existsSync(imagePath)) {
    console.log(`⏭  Skipped — no image at ${imagePath}`);
    console.log("   To test this step:");
    console.log("   1. Run `npm run test:nano` to produce a Gemini render");
    console.log("   2. Re-run this script with --image <path>\n");
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  // Sniff magic bytes rather than trust the extension — Gemini often saves
  // JPEGs into a .png container which trips Anthropic's media-type check.
  const mediaType = sniffImageMediaType(imageBuffer);

  const { system, user } = buildRenderReviewRequest({
    spec: fixture.spec,
    context: fixture.context,
  });

  console.log(`→ Calling Opus for render QA on ${imagePath}…\n`);

  const response = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_REVIEWER_MODEL,
    max_tokens: 2048,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: user },
        ],
      },
    ],
  });

  const text = extractText(response);
  let review: RenderReviewOutput;
  try {
    review = parseJsonFromClaude<RenderReviewOutput>(text);
  } catch {
    console.error("❌ Opus did not return valid JSON:");
    console.error(text);
    return;
  }

  console.log(`📊 Overall match: ${review.overall_match.toUpperCase()}`);
  console.log(`📝 Summary: ${review.summary}\n`);

  console.log(`🔒 Preserved elements check:`);
  for (const p of review.preserved_elements_check) {
    console.log(`  ${p.preserved ? "✅" : "❌"} ${p.element}`);
  }

  if (review.issues.length > 0) {
    console.log(`\n⚠️  Issues found (${review.issues.length}):`);
    for (const issue of review.issues) {
      const sevIcon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
      console.log(`\n  ${sevIcon} [${issue.severity}] ${issue.element}`);
      console.log(`     Expected: ${issue.expected}`);
      console.log(`     Observed: ${issue.observed}`);
      console.log(`     Fix hint: ${issue.correction_hint}`);
    }
  } else {
    console.log("\n  No issues found.");
  }

  console.log(
    `\n${review.approved_to_show_designer ? "✅ APPROVED" : "🚫 NEEDS REGEN"} — ${review.approved_to_show_designer ? "ready to show designer" : "regenerate before showing designer"}`,
  );
}

async function main() {
  loadEnvLocal();
  claude = await import("../lib/claude/client");

  const { fixtureName, imagePath } = parseCliArgs(process.argv.slice(2));
  const fixture = getFixture(fixtureName);

  const promptOutput = await testPromptGeneration(fixture);
  await testPromptReview(fixture, promptOutput);

  if (imagePath) {
    await testRenderReview(fixture, imagePath);
  } else {
    printDivider("STAGE 3: Render QA Review — SKIPPED");
    console.log("No --image provided. To test Stage 3:");
    console.log("  npm run test:prompts -- --image ./path/to/render.png");
    console.log("  npm run test:prompts -- vincent-ave-kitchen --image ./path/to/render.png\n");
  }

  printDivider("DONE");
}

function parseCliArgs(argv: string[]): { fixtureName: string; imagePath: string | null } {
  let fixtureName = DEFAULT_FIXTURE;
  let imagePath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--image") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("❌ --image requires a path argument");
        process.exit(1);
      }
      imagePath = next;
      i += 1;
    } else if (a === "--fixture") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("❌ --fixture requires a name argument");
        process.exit(1);
      }
      fixtureName = next;
      i += 1;
    } else if (!a.startsWith("--")) {
      // First bare positional is treated as the fixture name.
      if (a in FIXTURES) {
        fixtureName = a;
      } else if (/\.(png|jpe?g|webp)$/i.test(a)) {
        // Back-compat: the old single-positional was an image path.
        imagePath = a;
      } else {
        console.error(`❌ Unknown positional argument "${a}".`);
        console.error(`   Known fixtures: ${Object.keys(FIXTURES).sort().join(", ")}`);
        console.error(`   For an image path, use --image <path>.`);
        process.exit(1);
      }
    }
  }

  return { fixtureName, imagePath };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
