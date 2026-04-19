# Everyday Studio — Phase 1

Internal design tool for FRNK Holdings fix-and-flip properties. Phase 1 ships a moodboard-driven render pipeline:

1. **Project theme** (`lib/briefs/schema.ts` → `ProjectThemeSchema`) — one row per property; budget tier + aesthetic preset (or custom description)
2. **Room brief** (`lib/briefs/schema.ts` → `RoomBriefSchema`) — versioned per room; creative answers + non-negotiables + moodboard categories
3. **The Claude prompt builders** (`lib/claude/prompts.ts`) — `buildRenderPromptRequest` / `buildPromptReviewRequest` / `buildRenderReviewRequest` all consume `RenderPromptInput`
4. **The Gemini rendering module** (`lib/gemini/`) — client, contents-array builder, edit prompts, reference-material loader
5. **Test harnesses** (`scripts/test-prompts.ts`, `scripts/run-render-e2e.ts`, `scripts/test-nano-banana.ts`, `scripts/validate-opus-reviewer.ts`) — validate against the Vincent Ave brief fixture

> Historical note: Phase 1 originally shipped with a structured `RoomSpec` discriminated union (`lib/specs/schema.ts`). Session 7 replaced it with the moodboard brief above. The retired artifacts live under `test-fixtures/_legacy/` for historical reference only.

---

## Setup

```bash
npm install
# .env.local
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

Apply migrations:

```bash
npx supabase db push
```

Run the dev server:

```bash
npm run dev
```

## Run the prompt tests

```bash
# End-to-end Sonnet -> Opus prompt-review loop against the Vincent Ave brief fixture
npm run test:prompts
```

Prints the Gemini-targeted prompt Sonnet produced, Opus's verdict, and automated structural checks.

## Test a real Gemini render

```bash
# 1. Place a dated kitchen before-photo at test-fixtures/vincent-before.jpg
# 2. Run:
npm run test:nano

# Output:
#   test-fixtures/nano-banana-output-<model>.png
#   test-fixtures/nano-banana-prompt-<model>.txt

# Attach reference images (1–4):
npm run test:nano -- --references test-fixtures/ref-zellige.jpg test-fixtures/ref-brass.jpg

# Iterate conversationally:
npm run edit:nano -- --base test-fixtures/nano-banana-output-gemini-3-pro-image-preview.png "Change the backsplash to vertical stack zellige"
```

`test-nano-banana.ts` drives Gemini directly with a hand-written prompt — for full-pipeline testing (brief → Sonnet → Opus → Gemini → Opus), use `run-render-e2e.ts`:

```bash
npx tsx scripts/run-render-e2e.ts <room_id> <base_photo_id>
```

This is what `POST /api/render/generate` runs internally.

## Review a render against the brief

```bash
# Triggers Opus image review via the API route
curl -X POST "$BASE_URL/api/renders/<render_id>/review"
```

## File layout

```
lib/
  briefs/
    schema.ts                 # Zod: ProjectThemeSchema, RoomBriefSchema, CategoryMoodboardSchema
    room-types.ts             # RoomTypeEnum + labels (13 types)
    categories.ts             # CATEGORIES_BY_ROOM (moodboard categories per room type)
    questions.ts              # QUESTIONS_BY_ROOM (creative-direction prompts per room type)
    themes.ts                 # THEME_PRESETS + BUDGET_TIER_OPTIONS
    prompt-input.ts           # RenderPromptInput shape + buildRenderPromptInput + summarizeBriefForPrompt
    load.ts                   # loadPromptInput — joins property + room + brief + theme under RLS
  properties/
    property.ts               # CreatePropertyInput / PatchPropertyInput / formatUsd
    buyer-personas.ts         # BuyerPersonaEnum + labels
  claude/
    prompts.ts                # buildRenderPromptRequest + buildPromptReviewRequest + buildRenderReviewRequest
    client.ts                 # Sonnet operator + Opus reviewer model IDs
  gemini/
    client.ts                 # GoogleGenAI + generateImage()
    prompts.ts                # buildContentsArray (base + references + text)
    edit-prompts.ts           # buildEditPrompt for conversational edits
    references.ts             # ReferenceFileReader, localFsReader, supabaseStorageReader
  render/
    pipeline.ts               # runGeneratePipeline (Sonnet -> Opus -> Gemini -> Opus)
    types.ts                  # Pipeline types
scripts/
  test-prompts.ts             # Claude prompt harness (brief fixture + Stage 1+2+3)
  run-render-e2e.ts           # Full pipeline E2E (bypasses HTTP auth)
  test-nano-banana.ts         # Direct Gemini probe, hand-written prompt
  validate-opus-reviewer.ts   # Opus prompt-review efficacy (N repeats of the one brief fixture)
  edit-nano-banana.ts         # Gemini conversational edit harness
test-fixtures/
  vincent-ave-kitchen.ts      # Current brief + theme + prompt-input fixture
  _legacy/                    # Retired RoomSpec discriminated-union fixtures (excluded from tsc)
```

## What's next

1. Phase 2 surfaces (see `PHASE-2-SCOPE.md` — flag: the doc was written pre-moodboard-rewrite and needs revisiting before Phase 2 starts).
2. A Claude-vision pre-step that describes the before-photo and feeds the result into Sonnet, so the "REMOVE FROM ORIGINAL" prompt section isn't written blind.
3. Moodboard image upload UI polish (current tile drag-and-drop works but could use keyboard controls and clearer error states).
