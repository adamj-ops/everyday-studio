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
 *   1. .env.local has ANTHROPIC_API_KEY (scripts load it themselves or you
 *      can source it before running).
 *   2. npm run test:prompts
 *
 * Optional: pass a render image path as arg to also run Stage 3:
 *   npm run test:prompts -- ./test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png
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
import {
  vincentAveContext,
  vincentAveKitchenSpec,
  vincentAveKitchenBasePhotoDescription,
} from "../test-fixtures/vincent-ave-kitchen";

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

async function testPromptGeneration(): Promise<RenderPromptOutput> {
  printDivider(`STAGE 1: Sonnet generates the Gemini prompt (${claude.CLAUDE_OPERATOR_MODEL})`);

  const parsed = RoomSpecSchema.safeParse(vincentAveKitchenSpec);
  if (!parsed.success) {
    console.error("❌ Spec failed Zod validation:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }
  console.log("✅ Spec validates against Zod schema\n");

  const { system, user } = buildRenderPromptRequest({
    spec: parsed.data,
    context: vincentAveContext,
    base_photo_description: vincentAveKitchenBasePhotoDescription,
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
  const checks = [
    {
      name: `Prompt is at least 1500 chars (enough detail for Gemini, ${output.prompt.length} chars)`,
      pass: output.prompt.length >= 1500,
    },
    {
      name: `Prompt is under 6000 chars (advisory ceiling, ${output.prompt.length} chars)`,
      pass: output.prompt.length < 6000,
    },
    {
      name: "Prompt names Alabaster paint color",
      pass: /alabaster/i.test(output.prompt),
    },
    {
      name: "Prompt names zellige backsplash",
      pass: /zellige/i.test(output.prompt),
    },
    {
      name: "Prompt specifies vertical stack pattern",
      pass: /vertical/i.test(output.prompt) && /stack/i.test(output.prompt),
    },
    {
      name: "Prompt names brass hardware/pendants",
      pass: /brass/i.test(output.prompt),
    },
    {
      name: "Prompt names white oak / LVP flooring",
      pass: /(white oak|lvp)/i.test(output.prompt),
    },
    {
      name: "Prompt specifies morning light",
      pass: /morning/i.test(output.prompt),
    },
    {
      name: "Prompt includes a PRESERVE FROM ORIGINAL section",
      pass: /preserve from original/i.test(output.prompt),
    },
    {
      name: "Prompt includes a REMOVE FROM ORIGINAL section",
      pass: /remove from original/i.test(output.prompt),
    },
    {
      name: "Prompt ends with the standard close line",
      pass: /return the final rendered image only\.?\s*$/i.test(output.prompt.trim()),
    },
  ];
  for (const c of checks) {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`\n  ${passCount}/${checks.length} checks passed`);

  fs.writeFileSync(
    path.join(__dirname, "..", "test-fixtures", "last-prompt-output.json"),
    JSON.stringify(output, null, 2),
  );

  return output;
}

async function testPromptReview(promptOutput: RenderPromptOutput): Promise<PromptReviewOutput> {
  printDivider(`STAGE 2: Opus reviews Sonnet's prompt (${claude.CLAUDE_REVIEWER_MODEL})`);

  const { system, user } = buildPromptReviewRequest({
    spec: vincentAveKitchenSpec,
    context: vincentAveContext,
    base_photo_description: vincentAveKitchenBasePhotoDescription,
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
      path.join(__dirname, "..", "test-fixtures", "last-prompt-review.json"),
      JSON.stringify(review, null, 2),
    );
  }

  return review;
}

async function testRenderReview(imagePath: string) {
  printDivider(`STAGE 3: Opus QA on rendered image (${claude.CLAUDE_REVIEWER_MODEL})`);

  if (!fs.existsSync(imagePath)) {
    console.log(`⏭  Skipped — no image at ${imagePath}`);
    console.log("   To test this step:");
    console.log("   1. Run `npm run test:nano` to produce a Gemini render");
    console.log("   2. Re-run this script with the image path as arg\n");
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  // Sniff magic bytes rather than trust the extension — Gemini often saves
  // JPEGs into a .png container which trips Anthropic's media-type check.
  const mediaType = sniffImageMediaType(imageBuffer);

  const { system, user } = buildRenderReviewRequest({
    spec: vincentAveKitchenSpec,
    context: vincentAveContext,
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

  const imageArg = process.argv[2];

  const promptOutput = await testPromptGeneration();
  await testPromptReview(promptOutput);

  if (imageArg) {
    await testRenderReview(imageArg);
  } else {
    printDivider("STAGE 3: Render QA Review — SKIPPED");
    console.log("No image argument provided. To test Stage 3:");
    console.log("  npm run test:prompts -- ./path/to/render.png\n");
  }

  printDivider("DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
