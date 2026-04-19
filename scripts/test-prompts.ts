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
import { RoomBriefSchema, ProjectThemeSchema } from "../lib/briefs/schema";
import {
  buildRenderPromptRequest,
  buildPromptReviewRequest,
  buildRenderReviewRequest,
  type RenderPromptOutput,
  type PromptReviewOutput,
  type RenderReviewOutput,
} from "../lib/claude/prompts";
import {
  vincentAveKitchenBrief,
  vincentAveTheme,
  vincentAvePromptInput,
} from "../test-fixtures/vincent-ave-kitchen";

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

async function testPromptGeneration(): Promise<RenderPromptOutput> {
  printDivider(
    `STAGE 1: Sonnet generates the Gemini prompt (${claude.CLAUDE_OPERATOR_MODEL}) — fixture: vincent-ave-kitchen`,
  );

  const briefParsed = RoomBriefSchema.safeParse(vincentAveKitchenBrief);
  const themeParsed = ProjectThemeSchema.safeParse(vincentAveTheme);
  if (!briefParsed.success || !themeParsed.success) {
    console.error("❌ Fixture failed Zod validation");
    process.exit(1);
  }
  console.log("✅ Brief and theme validate against Zod schemas\n");

  const { system, user } = buildRenderPromptRequest(vincentAvePromptInput);

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
  const checks = buildHeuristicChecks(output.prompt);
  for (const c of checks) {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`\n  ${passCount}/${checks.length} checks passed`);

  fs.writeFileSync(
    path.join(__dirname, "..", "test-fixtures", "last-prompt-output-vincent-ave-kitchen.json"),
    JSON.stringify(output, null, 2),
  );

  return output;
}

async function testPromptReview(promptOutput: RenderPromptOutput): Promise<PromptReviewOutput> {
  printDivider(
    `STAGE 2: Opus reviews Sonnet's prompt (${claude.CLAUDE_REVIEWER_MODEL}) — fixture: vincent-ave-kitchen`,
  );

  const { system, user } = buildPromptReviewRequest({
    input: vincentAvePromptInput,
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
      path.join(__dirname, "..", "test-fixtures", "last-prompt-review-vincent-ave-kitchen.json"),
      JSON.stringify(review, null, 2),
    );
  }

  return review;
}

async function testRenderReview(imagePath: string) {
  printDivider(
    `STAGE 3: Opus QA on rendered image (${claude.CLAUDE_REVIEWER_MODEL}) — fixture: vincent-ave-kitchen`,
  );

  if (!fs.existsSync(imagePath)) {
    console.log(`⏭  Skipped — no image at ${imagePath}`);
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const mediaType = sniffImageMediaType(imageBuffer);

  const { system, user } = buildRenderReviewRequest({ input: vincentAvePromptInput });

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

  const imagePath = parseImagePathArg(process.argv.slice(2));

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
