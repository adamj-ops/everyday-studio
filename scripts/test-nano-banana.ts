/**
 * Everyday Studio — Nano Banana (Gemini 2.5 Flash Image) test harness
 *
 * Tests whether Gemini can render our Vincent Ave spec onto an intact
 * dated kitchen photo. Companion to scripts/test-prompts.ts (which
 * validates the Claude-side prompt generation).
 *
 * Usage:
 *   1. Ensure GEMINI_API_KEY is in .env.local
 *   2. Place a dated kitchen photo at test-fixtures/vincent-before.jpg
 *   3. Run: npm run test:nano
 *
 * Output:
 *   - test-fixtures/nano-banana-output.png  (generated image)
 *   - test-fixtures/nano-banana-prompt.txt  (the full prompt sent to Gemini,
 *     for iteration and debugging)
 *
 * What we're testing:
 *   - Does Gemini preserve the source kitchen's geometry (walls, window,
 *     doorway) while transforming every surface?
 *   - Does it honor specific material callouts (Alabaster, zellige vertical
 *     stack, brass, white oak LVP)?
 *   - Is the output on-spec enough to skip Flux and use Gemini as our
 *     primary mockup model?
 */

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { vincentAveKitchenSpec, vincentAveContext } from "../test-fixtures/vincent-ave-kitchen";
import { buildContentsArray, MAX_REFERENCES } from "../lib/gemini/prompts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "gemini-3-pro-image-preview";
const MODEL = process.env.MODEL ?? DEFAULT_MODEL;
const MODEL_SLUG = MODEL.replace(/[^a-z0-9]+/gi, "-");
const BEFORE_PHOTO = "test-fixtures/vincent-before.jpg";

function outputPaths(withRefs: boolean): { image: string; promptLog: string } {
  const refTag = withRefs ? "-with-refs" : "";
  return {
    image: `test-fixtures/nano-banana-output${refTag}-${MODEL_SLUG}.png`,
    promptLog: `test-fixtures/nano-banana-prompt${refTag}-${MODEL_SLUG}.txt`,
  };
}

// ---------------------------------------------------------------------------
// CLI parsing — supports --references <path1> [path2 ...]
// ---------------------------------------------------------------------------

function parseReferencesFlag(argv: string[]): string[] {
  const idx = argv.indexOf("--references");
  if (idx === -1) return [];
  const refs: string[] = [];
  for (let i = idx + 1; i < argv.length; i++) {
    const v = argv[i];
    if (v.startsWith("--")) break;
    refs.push(v);
  }
  if (refs.length === 0) {
    console.error("❌ --references given with no paths");
    process.exit(1);
  }
  if (refs.length > MAX_REFERENCES) {
    console.error(`❌ --references supports at most ${MAX_REFERENCES} paths (got ${refs.length})`);
    process.exit(1);
  }
  return refs;
}

function loadImageAsInput(filePath: string): { mimeType: string; dataBase64: string } {
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

// ---------------------------------------------------------------------------
// Minimal .env.local loader (no dotenv dep needed)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Prompt builder — Gemini-style natural language (not Flux CLIP-style)
// ---------------------------------------------------------------------------

/**
 * Nano Banana prompts differ from Flux prompts in three ways:
 *   1. Conversational and long is fine (1000–2500 chars typical)
 *   2. Explicit geometry-lock instructions at the top
 *   3. Explicit removal instructions for the "before" state elements
 *
 * We use the same spec fixture as the Flux test so we can compare outputs
 * directly.
 */
function buildNanoBananaPrompt(): string {
  const spec = vincentAveKitchenSpec;
  const ctx = vincentAveContext;

  return `Render this kitchen as a finished, photorealistic renovation. Keep the existing room dimensions, ceiling height, window placements, and doorway locations exactly as they are in the source photo — do not change the architecture.

Property context: ${ctx.address}, target buyer is a ${ctx.buyer_persona.replace(/_/g, " ")}. Design direction: ${ctx.style_direction}.

DESIGN SPECIFICATION:

Cabinets: Shaker-style full-overlay cabinets painted ${spec.paint.walls.color_name} (${spec.paint.walls.color_code}), a warm creamy white. Upper cabinets run all the way to the ceiling — no soffit, no gap above. Lower cabinets standard counter height.

Hardware: Unlacquered brass throughout. 6-inch bar pulls on all drawers, 1.25-inch round knobs on all cabinet doors. The brass is unlacquered so it has a slightly raw, warm-golden tone — not chrome, not polished brass.

Counters: Cambria Brittanicca Warm quartz, 3cm thickness with an eased edge. This is a warm white quartz with soft gray veining and subtle warm undertones — not stark white, not gray.

Backsplash: Clé Zellige handmade tile, 3x12 format, in "Weathered White" — a warm creamy off-white with subtle color variation characteristic of handmade zellige. Installed in a VERTICAL STACK pattern (not horizontal subway), running from counter all the way to the ceiling. Tile-matched grout — the grout should match the tile color so the overall surface reads as one unified texture. Do NOT default to horizontal subway tile. The pattern is vertical.

Island: 4-foot by 8-foot island, painted the same ${spec.paint.walls.color_name} as the cabinets. Seats 3 people on one side. Same brass hardware as the perimeter cabinets.

Appliances: Stainless steel slide-in range. Panel-ready refrigerator and dishwasher — these should be clad in cabinet panels matching the surrounding cabinetry so they blend in and read as cabinets, not as visible appliances. Panel-ready custom shaker hood cover painted ${spec.paint.walls.color_name} running up to the ceiling above the range.

Plumbing: Matte black gooseneck single-handle kitchen faucet. Single-bowl stainless steel undermount sink, 32 inches wide.

Lighting: Two unlacquered brass schoolhouse-style pendants hanging over the island, spaced evenly. Recessed can lights in the ceiling around the perimeter work zones. Remove any existing ceiling fixture that doesn't match this description.

Flooring: 7-inch wide plank white oak luxury vinyl plank (LVP) in a warm natural honey tone, matte finish. Wide planks running parallel to the longest wall.

Walls: Painted ${spec.paint.walls.color_name} (${spec.paint.walls.color_code}) in eggshell finish. Warm creamy white, not stark white.

Trim and ceiling: Painted Sherwin-Williams Pure White (SW 7005) in semi-gloss for trim, flat for ceiling.

PRESERVE FROM THE ORIGINAL PHOTO:
${spec.existing_to_keep.map((e) => `  - ${e}`).join("\n")}

REMOVE FROM THE ORIGINAL:
  - All existing cabinetry (replace with the spec above)
  - All existing countertops (replace with Brittanicca Warm quartz)
  - All existing backsplash or wall tile (replace with vertical stack zellige)
  - All existing flooring (replace with white oak LVP)
  - Any fluorescent box lighting (replace with pendants + recessed)
  - Any existing paint colors on walls (repaint in Alabaster)
  - Any popcorn ceiling texture (ceiling should be smooth)
  - Any dated hardware or fixtures

STAGING: Keep the counters mostly clear. Morning light coming through the window. One wooden cutting board with fresh sourdough on the counter near the sink. Small potted herb on the windowsill. No people, no clutter, no text, no watermarks.

STYLE: Warm transitional kitchen, photorealistic, architectural interior photography, editorial magazine quality, 35mm lens, natural light, shallow depth of field on staging props.

Return the final rendered image only.`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvLocal();

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set in .env.local");
    process.exit(1);
  }

  if (!fs.existsSync(BEFORE_PHOTO)) {
    console.error(`❌ Before-photo not found at ${BEFORE_PHOTO}`);
    console.error("   Place a dated kitchen photo there and re-run.");
    process.exit(1);
  }

  const referencePaths = parseReferencesFlag(process.argv.slice(2));
  const { image: OUTPUT_IMAGE, promptLog: OUTPUT_PROMPT_LOG } = outputPaths(
    referencePaths.length > 0,
  );

  console.log("=".repeat(70));
  console.log("NANO BANANA TEST — Vincent Ave kitchen, intact-dated source");
  console.log(`Model: ${MODEL}${process.env.MODEL ? " (via MODEL env var)" : " (default)"}`);
  if (referencePaths.length > 0) {
    console.log(`References (${referencePaths.length}):`);
    referencePaths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  }
  console.log("=".repeat(70));

  const prompt = buildNanoBananaPrompt();
  fs.writeFileSync(OUTPUT_PROMPT_LOG, prompt);
  console.log(`\n📝 Prompt length: ${prompt.length} chars`);
  console.log(`   Saved to: ${OUTPUT_PROMPT_LOG}`);

  const basePhoto = loadImageAsInput(BEFORE_PHOTO);
  console.log(
    `\n📸 Source photo: ${BEFORE_PHOTO} (${basePhoto.mimeType}, ${Math.round((basePhoto.dataBase64.length * 3) / 4 / 1024)} KB base64)`,
  );

  const references = referencePaths.map((p) => loadImageAsInput(p));

  const contents = buildContentsArray({ basePhoto, references, promptText: prompt });

  console.log(`\n→ Calling ${MODEL}…`);
  const startTime = Date.now();

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await client.models.generateContent({
    model: MODEL,
    contents,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   Completed in ${elapsed}s\n`);

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let imageSaved = false;
  let textCommentary = "";

  for (const part of parts) {
    if (part.inlineData?.data && !imageSaved) {
      const outputBuffer = Buffer.from(part.inlineData.data, "base64");
      fs.writeFileSync(OUTPUT_IMAGE, outputBuffer);
      console.log(`✅ Image saved: ${OUTPUT_IMAGE} (${(outputBuffer.length / 1024).toFixed(0)} KB)`);
      imageSaved = true;
    } else if (part.text) {
      textCommentary += part.text;
    }
  }

  if (!imageSaved) {
    console.error("❌ No image returned in response");
    console.error("   Model commentary:", textCommentary || "(none)");
    console.error("   Full response:", JSON.stringify(response, null, 2).slice(0, 2000));
    process.exit(1);
  }

  if (textCommentary.trim()) {
    console.log(`\n💬 Model commentary:\n   ${textCommentary.trim().slice(0, 500)}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEPS");
  console.log("=".repeat(70));
  console.log(`
1. Open ${OUTPUT_IMAGE} and evaluate against the spec:
   - Cabinets Alabaster shaker, to ceiling?
   - Zellige VERTICAL stack (not horizontal)?
   - Brittanicca Warm quartz (warm white with soft gray veining)?
   - White oak LVP, wide plank, parallel to longest wall?
   - Unlacquered brass hardware and pendants?
   - Matte black faucet?
   - Panel-ready fridge and dishwasher?
   - Preserved: north-facing window, east doorway to dining room?

2. If drift on any element, run the edit script to iterate:
     npm run edit:nano -- --base ${OUTPUT_IMAGE} "your correction instruction"
   e.g. npm run edit:nano -- --base ${OUTPUT_IMAGE} "Make the backsplash clearly vertical stacked, not horizontal subway tile"

3. Paste your evaluation back to Claude with the output image for
   end-to-end validation against the locked spec.
`);
}

main().catch((err) => {
  console.error("\n❌ Error:");
  console.error(err);
  process.exit(1);
});