/**
 * Everyday Studio — Nano Banana conversational edit test
 *
 * Takes a prior render and applies a follow-up edit instruction. This is
 * the workflow that replaces mask-based inpainting in Phase 1.
 *
 * Usage:
 *   npm run edit:nano -- --base test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png \
 *     "make the backsplash clearly vertical stacked, not horizontal"
 *
 *   npm run edit:nano -- "change the floor to wide-plank white oak"
 *     # --base defaults to the most recently modified test-fixtures/nano-banana-output*.png
 *
 *   npm run edit:nano -- --references test-fixtures/ref-zellige.jpg \
 *     "match the backsplash to the attached zellige reference"
 *
 * Output: test-fixtures/nano-banana-edit-{N}.png (auto-incrementing)
 */

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { buildEditPrompt } from "../lib/gemini/edit-prompts";
import { buildContentsArray, MAX_REFERENCES } from "../lib/gemini/prompts";

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const MODEL = process.env.MODEL ?? DEFAULT_MODEL;
const OUTPUT_DIR = "test-fixtures";

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

function nextEditFilename(): string {
  const existing = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => /^nano-banana-edit-\d+\.png$/.test(f))
    .map((f) => parseInt(f.match(/\d+/)![0], 10))
    .sort((a, b) => b - a);
  const next = (existing[0] ?? 0) + 1;
  return path.join(OUTPUT_DIR, `nano-banana-edit-${next}.png`);
}

/**
 * When --base isn't passed, find the most recently modified
 * test-fixtures/nano-banana-output*.png as a sensible default. Returns
 * null if none exist.
 */
function defaultBasePath(): string | null {
  if (!fs.existsSync(OUTPUT_DIR)) return null;
  const candidates = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => /^nano-banana-output.*\.png$/.test(f))
    .map((f) => {
      const full = path.join(OUTPUT_DIR, f);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.full ?? null;
}

function loadImage(filePath: string): { mimeType: string; dataBase64: string } {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { mimeType, dataBase64: buf.toString("base64") };
}

interface ParsedArgs {
  base: string | null;
  references: string[];
  instruction: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let base: string | null = null;
  const references: string[] = [];
  const positional: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--base") {
      base = argv[i + 1];
      if (!base || base.startsWith("--")) {
        console.error("❌ --base requires a path argument");
        process.exit(1);
      }
      i += 2;
    } else if (a === "--references") {
      i += 1;
      while (i < argv.length && !argv[i].startsWith("--")) {
        references.push(argv[i]);
        i += 1;
      }
    } else {
      positional.push(a);
      i += 1;
    }
  }

  if (references.length > MAX_REFERENCES) {
    console.error(
      `❌ --references supports at most ${MAX_REFERENCES} paths (got ${references.length})`,
    );
    process.exit(1);
  }

  const instruction = positional.join(" ").trim();
  return { base, references, instruction };
}

async function main() {
  loadEnvLocal();

  const { base: baseArg, references: referencePaths, instruction } = parseArgs(
    process.argv.slice(2),
  );

  if (!instruction) {
    console.error('❌ Usage: npm run edit:nano -- [--base <path>] [--references <p1> [p2 ...]] "your edit instruction"');
    console.error('   Example: npm run edit:nano -- --base test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png "make the backsplash clearly vertical stacked"');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set in .env.local");
    process.exit(1);
  }

  const basePath = baseArg ?? defaultBasePath();
  if (!basePath) {
    console.error(
      "❌ No --base passed and no test-fixtures/nano-banana-output*.png found. Run `npm run test:nano` first or pass --base explicitly.",
    );
    process.exit(1);
  }
  if (!fs.existsSync(basePath)) {
    console.error(`❌ Base image not found: ${basePath}`);
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("NANO BANANA EDIT — conversational iteration");
  console.log(`Model: ${MODEL}${process.env.MODEL ? " (via MODEL env var)" : " (default)"}`);
  console.log(`Base:  ${basePath}${baseArg ? "" : " (default: most recent)"}`);
  if (referencePaths.length > 0) {
    console.log(`References (${referencePaths.length}):`);
    referencePaths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  }
  console.log("=".repeat(70));
  console.log(`\n🎯 Edit instruction:\n   "${instruction}"`);

  const basePhoto = loadImage(basePath);
  const references = referencePaths.map((p) => loadImage(p));

  const referenceHints =
    referencePaths.length > 0
      ? referencePaths.map((p) => path.basename(p, path.extname(p)))
      : undefined;

  const prompt = buildEditPrompt({ instruction, referenceHints });
  console.log(`\n📝 Full prompt (${prompt.length} chars):\n   ${prompt.slice(0, 240)}…\n`);

  const contents = buildContentsArray({ basePhoto, references, promptText: prompt });

  console.log(`→ Calling ${MODEL}…`);
  const startTime = Date.now();

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await client.models.generateContent({
    model: MODEL,
    contents,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   Completed in ${elapsed}s`);

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let outputPath: string | null = null;
  let commentary = "";

  for (const part of parts) {
    if (part.inlineData?.data && !outputPath) {
      outputPath = nextEditFilename();
      fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, "base64"));
    } else if (part.text) {
      commentary += part.text;
    }
  }

  if (!outputPath) {
    console.error("❌ No image returned");
    console.error("   Commentary:", commentary || "(none)");
    process.exit(1);
  }

  console.log(`\n✅ Edit saved: ${outputPath}`);
  if (commentary.trim()) {
    console.log(`\n💬 Model commentary:\n   ${commentary.trim().slice(0, 400)}`);
  }

  console.log(`\n🔄 To chain another edit against this result, pass it as --base:`);
  console.log(`   npm run edit:nano -- --base ${outputPath} "your next instruction"`);
}

main().catch((err) => {
  console.error("\n❌ Error:");
  console.error(err);
  process.exit(1);
});
