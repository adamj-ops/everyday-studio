# Everyday Studio — Phase 1 Keystone

Internal design tool for FRNK Holdings fix-and-flip properties. This repo contains the foundational pieces of Phase 1 that de-risk the entire Next.js build:

1. **The Zod spec schema** (`lib/specs/schema.ts`) — the data contract every room rides on
2. **The two production Claude prompts** (`lib/claude/prompts.ts`) — render prompt generation + QA review
3. **The Gemini rendering module** (`lib/gemini/`) — client, contents-array builder, edit prompts, reference-material loader
4. **The test harnesses** (`scripts/test-prompts.ts`, `scripts/test-nano-banana.ts`, `scripts/edit-nano-banana.ts`) — validate everything against a real Vincent Ave kitchen fixture

Validate these work before writing any Next.js code.

---

## Setup

```bash
npm install
# .env.local
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
```

## Run the prompt tests

```bash
# Test the Claude render-prompt-generation prompt (needs ANTHROPIC_API_KEY)
npm run test:prompts
```

You'll see the generated natural-language prompt Claude produced for Gemini, plus automated checks (does the prompt name Alabaster? Does it mention zellige? Is the vertical stack pattern specified?).

## Test a real Gemini render

```bash
# 1. Place a dated kitchen before-photo at test-fixtures/vincent-before.jpg
# 2. Run:
npm run test:nano

# Output:
#   test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png
#   test-fixtures/nano-banana-prompt-gemini-3-pro-image-preview.txt

# Attach designer reference images (1–4) to a render:
npm run test:nano -- --references test-fixtures/ref-zellige.jpg test-fixtures/ref-brass.jpg
# Output filenames gain a -with-refs suffix.

# Iterate on a render with conversational edits:
npm run edit:nano -- --base test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png "Change the backsplash to vertical stack zellige"
# If --base is omitted, the script uses the most recently modified test-fixtures/nano-banana-output*.png
```

## Review a render against the spec

```bash
npm run test:prompts -- ./test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png
```

The review prompt grades the render against the locked spec and flags drift (wrong pattern orientation, wrong hardware finish, missing spec elements, added windows, etc.).

## What to look for when evaluating

**On the generated render prompt:**

- Does it name every key material from the spec? (Alabaster, zellige, white oak LVP, brass, Cambria Brittanicca Warm quartz)
- Is it in the 2000–4000 character range? (Gemini natural-language, not CLIP.)
- Does it specify "vertical stack" for the backsplash (anti-drift)?
- Does it mention preserved elements (north-facing window, doorway)?
- Does it explicitly tear down the before-state elements in a REMOVE FROM ORIGINAL section?

**On the review:**

- Does it correctly flag drift when the render is wrong?
- Does it approve when the render actually matches spec?
- Are the correction hints phrased conversationally (something you could pass to Gemini as an edit)?

## File layout

```
lib/
  specs/schema.ts                 # Zod schemas, discriminated unions by room_type, ReferenceMaterialSchema
  claude/
    prompts.ts                    # buildRenderPromptRequest + buildRenderReviewRequest
    suggest.ts                    # field-level Suggest button for Spec Builder
  gemini/
    client.ts                     # singleton GoogleGenAI + GEMINI_IMAGE_MODEL + generateImage()
    prompts.ts                    # buildContentsArray (base + references + text)
    edit-prompts.ts               # buildEditPrompt for conversational edits
    references.ts                 # ReferenceFileReader, localFsReader, loadReferenceForGemini, formatReferencesForPrompt
scripts/
  test-prompts.ts                 # Claude prompt harness
  test-nano-banana.ts             # Gemini render harness (supports --references)
  edit-nano-banana.ts             # Gemini conversational edit harness (--base, --references)
test-fixtures/
  vincent-ave-kitchen.ts          # realistic Vincent Ave flip spec + context
```

## What to build next (once prompts + renders validate)

1. Spin up Next.js 14 app with Supabase (Session 3 — see `SESSIONS.md`)
2. Migrate the Zod schemas into Supabase (use the `spec_json` jsonb column — flexible)
3. Implement the `supabaseStorageReader` in `lib/gemini/references.ts` (replaces the TODO) and create the `property-references` Storage bucket
4. Build the three screens:
   - Property Setup (no AI)
   - Room Spec Builder (uses `suggest.ts`)
   - Mockup Studio (uses `prompts.ts` + `lib/gemini/*`) with a drag-and-drop Reference Materials panel

Phase 1 ships when the full Vincent Ave kitchen flow works end-to-end with Gemini 3 Pro Image Preview as the rendering primary.
