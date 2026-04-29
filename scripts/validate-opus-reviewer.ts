/**
 * Opus prompt-review efficacy probe (post-moodboard-rewrite)
 *
 * Runs the single surviving fixture (Vincent Ave kitchen brief) through
 * the Sonnet -> Opus prompt-review loop N times, writes per-run JSON dumps
 * to test-fixtures/opus-review-runs/, and prints a verdict distribution.
 *
 * Pre-rewrite this script used 5 fixtures to produce a keep/delete/tune
 * recommendation. The 4 discriminated-union fixtures are now in
 * test-fixtures/_legacy/ and not readable from the new prompt builders.
 * Until we have 2-3 additional brief-shaped fixtures, this script trades
 * breadth for depth: N repeats of the same fixture (temperature matters).
 *
 * Usage:
 *   npx tsx scripts/validate-opus-reviewer.ts            # 5 repeats (default)
 *   npx tsx scripts/validate-opus-reviewer.ts --n 10     # 10 repeats
 *
 * Decision rules (unchanged):
 *   >=90% ship_it across runs  -> DELETE (rubber-stamp)
 *   60-89% ship_it             -> KEEP (target)
 *   <60% ship_it               -> INVESTIGATE
 */

import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  buildRenderPromptForSurface,
  buildPromptReviewForSurface,
  type RenderPromptOutput,
  type PromptReviewOutput,
  type PromptReviewIssue,
} from "../lib/claude/prompts";
import { vincentAvePromptInput } from "../test-fixtures/vincent-ave-kitchen";

type ClaudeClientModule = typeof import("../lib/claude/client");
let claude: ClaudeClientModule;

const OUTPUT_DIR = path.join("test-fixtures", "opus-review-runs");
const DEFAULT_N = 5;

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

function parseN(argv: string[]): number {
  const i = argv.indexOf("--n");
  if (i === -1) return DEFAULT_N;
  const next = argv[i + 1];
  if (!next) return DEFAULT_N;
  const n = Number.parseInt(next, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_N;
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseJsonFromClaude<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

interface Run {
  index: number;
  verdict: PromptReviewOutput["verdict"];
  issues: PromptReviewIssue[];
  generated_prompt: string;
  notes: string;
  revised_prompt: string | null;
  elapsed_ms: number;
  sonnet_input_tokens?: number;
  sonnet_output_tokens?: number;
  opus_input_tokens?: number;
  opus_output_tokens?: number;
}

async function runOnce(index: number): Promise<Run> {
  const start = Date.now();

  const gen = buildRenderPromptForSurface(vincentAvePromptInput);

  const sonnetResp = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_OPERATOR_MODEL,
    max_tokens: 4096,
    system: gen.system,
    messages: [{ role: "user", content: gen.user }],
  });
  const promptOutput = parseJsonFromClaude<RenderPromptOutput>(extractText(sonnetResp));

  const rev = buildPromptReviewForSurface({
    input: vincentAvePromptInput,
    generated_prompt: promptOutput.prompt,
  });

  const opusResp = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_REVIEWER_MODEL,
    max_tokens: 4096,
    system: rev.system,
    messages: [{ role: "user", content: rev.user }],
  });
  const review = parseJsonFromClaude<PromptReviewOutput>(extractText(opusResp));

  return {
    index,
    verdict: review.verdict,
    issues: review.issues,
    generated_prompt: promptOutput.prompt,
    notes: promptOutput.notes,
    revised_prompt: review.revised_prompt,
    elapsed_ms: Date.now() - start,
    sonnet_input_tokens: sonnetResp.usage?.input_tokens,
    sonnet_output_tokens: sonnetResp.usage?.output_tokens,
    opus_input_tokens: opusResp.usage?.input_tokens,
    opus_output_tokens: opusResp.usage?.output_tokens,
  };
}

function severityMix(issues: PromptReviewIssue[]): string {
  if (issues.length === 0) return "-";
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.severity] += 1;
  const parts: string[] = [];
  if (counts.high) parts.push(`${counts.high}H`);
  if (counts.medium) parts.push(`${counts.medium}M`);
  if (counts.low) parts.push(`${counts.low}L`);
  return parts.join(" ");
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function verdictLabel(v: PromptReviewOutput["verdict"]): string {
  return v;
}

// Anthropic prices per million tokens (Apr 2026). Sonnet 4.6: $3/$15. Opus 4.7: $5/$25.
function estimateCostCents(run: Run): number {
  const sIn = run.sonnet_input_tokens ?? 0;
  const sOut = run.sonnet_output_tokens ?? 0;
  const oIn = run.opus_input_tokens ?? 0;
  const oOut = run.opus_output_tokens ?? 0;
  const dollars =
    (sIn * 3) / 1_000_000 +
    (sOut * 15) / 1_000_000 +
    (oIn * 5) / 1_000_000 +
    (oOut * 25) / 1_000_000;
  return Math.round(dollars * 100);
}

function recommendation(runs: Run[]): string {
  const n = runs.length;
  const shipIt = runs.filter((r) => r.verdict === "ship_it").length;
  const shipRate = shipIt / n;
  const pct = (shipRate * 100).toFixed(0);
  if (shipRate >= 0.9) {
    return `DELETE the Opus prompt-review stage - ${shipIt}/${n} (${pct}%) ship_it is a rubber-stamp.`;
  }
  if (shipRate < 0.6) {
    return `INVESTIGATE - ${shipIt}/${n} (${pct}%) ship_it is below target.`;
  }
  return `KEEP - ${shipIt}/${n} (${pct}%) ship_it is in the 60-89% target band. Review critique quality in per-run JSONs.`;
}

async function main() {
  loadEnvLocal();
  claude = await import("../lib/claude/client");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const n = parseN(process.argv.slice(2));
  console.log(`\nRunning ${n} Sonnet->Opus cycles against vincent-ave-kitchen...\n`);

  const runs: Run[] = [];
  for (let i = 1; i <= n; i++) {
    process.stdout.write(`  [run ${i}] `);
    try {
      const run = await runOnce(i);
      runs.push(run);
      const jsonPath = path.join(OUTPUT_DIR, `run-${String(i).padStart(2, "0")}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(run, null, 2));
      console.log(
        `${verdictLabel(run.verdict).padEnd(12)} ${String(run.issues.length).padStart(2)} issues   ${(run.elapsed_ms / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      console.log("ERROR");
      console.error(err);
      process.exit(1);
    }
  }

  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));
  console.log(
    pad("Run", 8) +
      pad("Verdict", 14) +
      pad("Issues", 8) +
      pad("Severity", 14) +
      pad("Elapsed", 10) +
      "Cost",
  );
  console.log("-".repeat(90));
  let totalCents = 0;
  for (const run of runs) {
    const cents = estimateCostCents(run);
    totalCents += cents;
    console.log(
      pad(String(run.index), 8) +
        pad(run.verdict, 14) +
        pad(String(run.issues.length), 8) +
        pad(severityMix(run.issues), 14) +
        pad(`${(run.elapsed_ms / 1000).toFixed(1)}s`, 10) +
        `$${(cents / 100).toFixed(2)}`,
    );
  }
  console.log("-".repeat(90));

  const counts = { ship_it: 0, revise: 0, regenerate: 0 };
  for (const r of runs) counts[r.verdict] += 1;
  console.log(
    `\nVerdicts: ${counts.ship_it}/${n} ship_it (${Math.round((counts.ship_it / n) * 100)}%), ` +
      `${counts.revise}/${n} revise (${Math.round((counts.revise / n) * 100)}%), ` +
      `${counts.regenerate}/${n} regenerate (${Math.round((counts.regenerate / n) * 100)}%)`,
  );
  console.log(`Total estimated cost: $${(totalCents / 100).toFixed(2)}`);
  console.log(`Per-run JSONs written to: ${OUTPUT_DIR}/`);
  console.log(`\nRecommendation: ${recommendation(runs)}`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
