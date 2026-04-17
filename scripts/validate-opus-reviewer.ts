/**
 * Session 2.5 — Opus-review efficacy validation
 *
 * Runs all 5 fixtures through the Sonnet → Opus prompt-review pipeline,
 * writes per-fixture JSON dumps to test-fixtures/opus-review-runs/, and
 * prints a summary table plus a keep/delete/tune recommendation.
 *
 * Decision rules (locked):
 *   ≥90% ship_it  → DELETE (rubber-stamp)
 *   60–89% ship_it with useful critiques → KEEP (target)
 *   <60% ship_it  → INVESTIGATE
 *
 * Does NOT evaluate critique quality — that's a human eyeball job after
 * reading the per-fixture JSONs.
 */

import type Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  buildRenderPromptRequest,
  buildPromptReviewRequest,
  type RenderPromptOutput,
  type PromptReviewOutput,
  type PromptReviewIssue,
} from "../lib/claude/prompts";
import { FIXTURES, type FixtureRecord } from "../test-fixtures/registry";

type ClaudeClientModule = typeof import("../lib/claude/client");
let claude: ClaudeClientModule;

const OUTPUT_DIR = path.join("test-fixtures", "opus-review-runs");

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

interface FixtureRun {
  fixture: string;
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

async function runFixture(fixture: FixtureRecord): Promise<FixtureRun> {
  const start = Date.now();

  const gen = buildRenderPromptRequest({
    spec: fixture.spec,
    context: fixture.context,
    base_photo_description: fixture.basePhotoDescription,
    references: fixture.references,
  });

  const sonnetResp = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_OPERATOR_MODEL,
    max_tokens: 4096,
    system: gen.system,
    messages: [{ role: "user", content: gen.user }],
  });
  const promptOutput = parseJsonFromClaude<RenderPromptOutput>(extractText(sonnetResp));

  const rev = buildPromptReviewRequest({
    spec: fixture.spec,
    context: fixture.context,
    base_photo_description: fixture.basePhotoDescription,
    references: fixture.references,
    generated_prompt: promptOutput.prompt,
  });

  const opusResp = await claude.anthropicClient.messages.create({
    model: claude.CLAUDE_REVIEWER_MODEL,
    max_tokens: 4096,
    system: rev.system,
    messages: [{ role: "user", content: rev.user }],
  });
  const review = parseJsonFromClaude<PromptReviewOutput>(extractText(opusResp));

  const elapsed_ms = Date.now() - start;

  return {
    fixture: fixture.name,
    verdict: review.verdict,
    issues: review.issues,
    generated_prompt: promptOutput.prompt,
    notes: promptOutput.notes,
    revised_prompt: review.revised_prompt,
    elapsed_ms,
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

function verdictIcon(v: PromptReviewOutput["verdict"]): string {
  if (v === "ship_it") return "✅";
  if (v === "revise") return "✏️";
  return "🔁";
}

// Anthropic prices per million tokens (Apr 2026). Sonnet 4.6: $3/$15. Opus 4.7: $5/$25.
function estimateCostCents(run: FixtureRun): number {
  const sonnetIn = run.sonnet_input_tokens ?? 0;
  const sonnetOut = run.sonnet_output_tokens ?? 0;
  const opusIn = run.opus_input_tokens ?? 0;
  const opusOut = run.opus_output_tokens ?? 0;
  const dollars =
    (sonnetIn * 3) / 1_000_000 +
    (sonnetOut * 15) / 1_000_000 +
    (opusIn * 5) / 1_000_000 +
    (opusOut * 25) / 1_000_000;
  return Math.round(dollars * 100);
}

function recommendation(runs: FixtureRun[]): string {
  const n = runs.length;
  const shipIt = runs.filter((r) => r.verdict === "ship_it").length;
  const shipRate = shipIt / n;
  const pct = (shipRate * 100).toFixed(0);
  if (shipRate >= 0.9) {
    return `DELETE the Opus prompt-review stage — ${shipIt}/${n} (${pct}%) ship_it is a rubber-stamp.`;
  }
  if (shipRate < 0.6) {
    return `INVESTIGATE — ${shipIt}/${n} (${pct}%) ship_it is below target. Either Sonnet's prompts are weaker than expected or Opus is over-cautious. Read per-fixture JSONs before deciding.`;
  }
  return `KEEP — ${shipIt}/${n} (${pct}%) ship_it is in the 60–89% target band. Review critique quality in the per-fixture JSONs to confirm interventions are useful.`;
}

async function main() {
  loadEnvLocal();
  claude = await import("../lib/claude/client");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fixtures = Object.values(FIXTURES);
  console.log(`\nRunning ${fixtures.length} fixtures through Sonnet → Opus…\n`);

  const runs: FixtureRun[] = [];
  for (const fixture of fixtures) {
    process.stdout.write(`  [${fixture.name}] `);
    try {
      const run = await runFixture(fixture);
      runs.push(run);
      const jsonPath = path.join(OUTPUT_DIR, `${fixture.name}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(run, null, 2));
      console.log(
        `${verdictIcon(run.verdict)} ${run.verdict.padEnd(10)} ${String(run.issues.length).padStart(2)} issues   ${(run.elapsed_ms / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      console.log("❌ ERROR");
      console.error(err);
      process.exit(1);
    }
  }

  // Summary table
  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));
  console.log(
    pad("Fixture", 34) +
      pad("Verdict", 12) +
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
      pad(run.fixture, 34) +
        pad(run.verdict, 12) +
        pad(String(run.issues.length), 8) +
        pad(severityMix(run.issues), 14) +
        pad(`${(run.elapsed_ms / 1000).toFixed(1)}s`, 10) +
        `$${(cents / 100).toFixed(2)}`,
    );
  }
  console.log("-".repeat(90));

  const counts = { ship_it: 0, revise: 0, regenerate: 0 };
  for (const r of runs) counts[r.verdict] += 1;
  const n = runs.length;
  console.log(
    `\nVerdicts: ${counts.ship_it}/${n} ship_it (${Math.round((counts.ship_it / n) * 100)}%), ` +
      `${counts.revise}/${n} revise (${Math.round((counts.revise / n) * 100)}%), ` +
      `${counts.regenerate}/${n} regenerate (${Math.round((counts.regenerate / n) * 100)}%)`,
  );
  console.log(`Total estimated cost: $${(totalCents / 100).toFixed(2)}`);
  console.log(`Per-fixture JSONs written to: ${OUTPUT_DIR}/`);
  console.log(`\nRecommendation: ${recommendation(runs)}`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
