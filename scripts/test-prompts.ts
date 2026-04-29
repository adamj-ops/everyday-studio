/**
 * Everyday Studio — Prompt Test Harness
 *
 * Exercises the full two-tier Claude flow against the Vincent Ave kitchen
 * brief fixture so we can evaluate prompt + review quality BEFORE wiring
 * changes into the Next.js app:
 *
 *   Stage 1 — Sonnet (operator)  → Gemini prompt
 *   Stage 2 — Opus  (reviewer)   → verdict on Sonnet's prompt
 *   Stage 3 — Opus  (reviewer)   → QA on a rendered image (if provided)
 *
 * Usage:
 *   1. .env.local has ANTHROPIC_API_KEY (loaded automatically).
 *   2. npm run test:prompts                   # run all 3 stages (Stage 3 skipped without --image)
 *      npm run test:prompts -- --image <path> # run Stage 3 on a render
 *
 * Stage 2 is deliberately a no-apply display: we want to judge whether
 * Opus's prompt review adds signal or rubber-stamps Sonnet >90% of the time.
 * Don't auto-apply revisions in the harness — that's an app-logic decision
 * once we've validated the pattern.
 */

import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { SpaceBriefSchema, ProjectThemeSchema } from "../lib/briefs/schema";
import {
  buildRenderPromptForSurface,
  buildPromptReviewForSurface,
  buildRenderReviewRequest,
  type RenderPromptOutput,
  type PromptReviewOutput,
  type RenderReviewOutput,
} from "../lib/claude/prompts";
import type { ProjectTheme, SpaceBrief } from "../lib/briefs/schema";
import type { RenderPromptInput } from "../lib/briefs/prompt-input";
import {
  vincentAveKitchenBrief,
  vincentAveTheme,
  vincentAvePromptInput,
} from "../test-fixtures/vincent-ave-kitchen";
import {
  vincentAveFacadeBrief,
  vincentAveFacadeTheme,
  vincentAveFacadePromptInput,
} from "../test-fixtures/vincent-ave-facade";
import {
  lyndaleHardscapeBrief,
  lyndaleHardscapeTheme,
  lyndaleHardscapePromptInput,
} from "../test-fixtures/lyndale-hardscape";
import {
  lyndaleLandscapeBrief,
  lyndaleLandscapeTheme,
  lyndaleLandscapePromptInput,
} from "../test-fixtures/lyndale-landscape";
import {
  bevsTestGardenBrief,
  bevsTestGardenTheme,
  bevsTestGardenPromptInput,
} from "../test-fixtures/bevs-test-garden";

type ClaudeClientModule = typeof import("../lib/claude/client");

interface PromptFixture {
  key: string;
  brief: SpaceBrief;
  theme: ProjectTheme;
  input: RenderPromptInput;
  knownPromptTodo?: string;
}

const FIXTURES: Record<string, PromptFixture> = {
  "vincent-ave-kitchen": {
    key: "vincent-ave-kitchen",
    brief: vincentAveKitchenBrief,
    theme: vincentAveTheme,
    input: vincentAvePromptInput,
  },
  "vincent-ave-facade": {
    key: "vincent-ave-facade",
    brief: vincentAveFacadeBrief,
    theme: vincentAveFacadeTheme,
    input: vincentAveFacadePromptInput,
    knownPromptTodo: "TODO(adamj-ops): tune facade prompt validation after v1 surface fixtures land.",
  },
  "lyndale-hardscape": {
    key: "lyndale-hardscape",
    brief: lyndaleHardscapeBrief,
    theme: lyndaleHardscapeTheme,
    input: lyndaleHardscapePromptInput,
    knownPromptTodo: "TODO(adamj-ops): tune hardscape prompt validation after v1 surface fixtures land.",
  },
  "lyndale-landscape": {
    key: "lyndale-landscape",
    brief: lyndaleLandscapeBrief,
    theme: lyndaleLandscapeTheme,
    input: lyndaleLandscapePromptInput,
    knownPromptTodo: "TODO(adamj-ops): tune landscape prompt validation after v1 surface fixtures land.",
  },
  "bevs-test-garden": {
    key: "bevs-test-garden",
    brief: bevsTestGardenBrief,
    theme: bevsTestGardenTheme,
    input: bevsTestGardenPromptInput,
    knownPromptTodo: "TODO(adamj-ops): tune garden prompt validation after Bev's real project data is known.",
  },
};

let activeFixture = FIXTURES["vincent-ave-kitchen"];

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

function buildHeuristicChecks(prompt: string): HeuristicCheck[] {
  return [
    {
      name: `Prompt is at least 1200 chars (enough detail for Gemini, ${prompt.length} chars)`,
      pass: prompt.length >= 1200,
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
    { name: "honors the 'no gray' non-negotiable", pass: !/gray\b/i.test(prompt) || /not gray|no gray|avoid gray/i.test(prompt) },
    { name: "names unlacquered brass", pass: /unlacquered brass/i.test(prompt) },
    { name: "names zellige backsplash", pass: /zellige/i.test(prompt) },
    {
      name: "specifies vertical stack tile pattern",
      pass: /vertical/i.test(prompt) && /stack/i.test(prompt),
    },
    { name: "names shaker cabinets", pass: /shaker/i.test(prompt) },
    { name: "names SW Alabaster paint color", pass: /alabaster/i.test(prompt) },
  ];
}

function buildSurfaceHeuristicChecks(prompt: string): HeuristicCheck[] {
  return [
    {
      name: `Prompt is at least 1000 chars (surface v1 advisory, ${prompt.length} chars)`,
      pass: prompt.length >= 1000,
    },
    {
      name: `Prompt is under 6000 chars (advisory ceiling, ${prompt.length} chars)`,
      pass: prompt.length < 6000,
    },
    {
      name: "Prompt includes preservation language",
      pass: /preserve|keep|do not move|exactly as/i.test(prompt),
    },
    {
      name: "Prompt includes a final rendered image close line",
      pass: /return the final rendered image only\.?\s*$/i.test(prompt.trim()),
    },
  ];
}

async function testPromptGeneration(): Promise<RenderPromptOutput> {
  printDivider(
    `STAGE 1: Sonnet generates the Gemini prompt (${claude.CLAUDE_OPERATOR_MODEL}) — fixture: ${activeFixture.key}`,
  );

  const briefParsed = SpaceBriefSchema.safeParse(activeFixture.brief);
  const themeParsed = ProjectThemeSchema.safeParse(activeFixture.theme);
  if (!briefParsed.success || !themeParsed.success) {
    console.error("❌ Fixture failed Zod validation");
    process.exit(1);
  }
  console.log("✅ Brief and theme validate against Zod schemas\n");

  if (activeFixture.knownPromptTodo) {
    console.log(`Known v1 surface fixture note: ${activeFixture.knownPromptTodo}\n`);
  }

  const { system, user } = buildRenderPromptForSurface(activeFixture.input);

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
  const checks =
    activeFixture.input.surface_type === "interior_room"
      ? buildHeuristicChecks(output.prompt)
      : buildSurfaceHeuristicChecks(output.prompt);
  for (const c of checks) {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`\n  ${passCount}/${checks.length} checks passed`);

  fs.writeFileSync(
    path.join(__dirname, "..", "test-fixtures", `last-prompt-output-${activeFixture.key}.json`),
    JSON.stringify(output, null, 2),
  );

  return output;
}

async function testPromptReview(promptOutput: RenderPromptOutput): Promise<PromptReviewOutput> {
  printDivider(
    `STAGE 2: Opus reviews Sonnet's prompt (${claude.CLAUDE_REVIEWER_MODEL}) — fixture: ${activeFixture.key}`,
  );

  const { system, user } = buildPromptReviewForSurface({
    input: activeFixture.input,
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
      path.join(__dirname, "..", "test-fixtures", `last-prompt-review-${activeFixture.key}.json`),
      JSON.stringify(review, null, 2),
    );
  }

  return review;
}

async function testRenderReview(imagePath: string) {
  printDivider(
    `STAGE 3: Opus QA on rendered image (${claude.CLAUDE_REVIEWER_MODEL}) — fixture: ${activeFixture.key}`,
  );

  if (!fs.existsSync(imagePath)) {
    console.log(`⏭  Skipped — no image at ${imagePath}`);
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const mediaType = sniffImageMediaType(imageBuffer);

  const { system, user } = buildRenderReviewRequest({ input: activeFixture.input });

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

  const argv = process.argv.slice(2);
  const fixtureKey = parseFixtureArg(argv);
  activeFixture = FIXTURES[fixtureKey];
  if (!activeFixture) {
    console.error(`❌ Unknown fixture "${fixtureKey}". Available: ${Object.keys(FIXTURES).join(", ")}`);
    process.exit(1);
  }
  const imagePath = parseImagePathArg(argv);

  const promptOutput = await testPromptGeneration();
  await testPromptReview(promptOutput);

  if (imagePath) {
    await testRenderReview(imagePath);
  } else {
    printDivider("STAGE 3: Render QA Review — SKIPPED");
    console.log("No --image provided. To test Stage 3:");
    console.log("  npm run test:prompts -- --image ./path/to/render.png\n");
  }

  printDivider("DONE");
}

function parseFixtureArg(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--fixture") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("❌ --fixture requires a fixture key");
        process.exit(1);
      }
      return next;
    }
  }
  return "vincent-ave-kitchen";
}

function parseImagePathArg(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--image") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("❌ --image requires a path argument");
        process.exit(1);
      }
      return next;
    }
  }
  return null;
}

main().catch((err) => {
  console.error("\n❌ Test harness failed:", err);
  process.exit(1);
});
