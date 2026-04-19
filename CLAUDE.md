# Everyday Studio — Claude Code Context

Internal design tool for FRNK Holdings' fix-and-flip operations. Used by the in-house interior designer to go from CompanyCam before-photos to on-spec mockups, contractor build sheets, MLS-staged photos, and investor portfolio pages — all from one app.

Phase 1 scope: **Property Setup → Project Theme → Room Brief (moodboard) → Mockup Studio.** Everything else is Phase 2+.

> Session 7 replaced the original `RoomSpec` discriminated-union "Spec Builder" with a moodboard-driven Brief. References below to `lib/specs/*` and `room_specs` are historical; the live data contract is `lib/briefs/*` + tables `project_themes` + `room_briefs`.

---

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript (strict), Tailwind, shadcn/ui
- **Backend:** Next.js API routes, Supabase (Postgres + Auth + Storage)
- **AI:** Anthropic Claude with a two-tier architecture:
  - **Claude Sonnet 4.6** as **operator** — prompt generation, field suggestions, any high-frequency generation call.
  - **Claude Opus 4.7** as **reviewer** — prompt QA before rendering, image QA after rendering. Opus gatekeeps anything visual that ships to a designer or contractor.
  - Both configurable via `CLAUDE_OPERATOR_MODEL` and `CLAUDE_REVIEWER_MODEL` env vars (defaults in `lib/claude/client.ts`).
  - Google Gemini 2.5 Pro Image (model: `gemini-3-pro-image-preview`) for all rendering — full-room mockups and conversational element edits. No Replicate, no Flux, no SDXL.
- **Hosting:** Vercel
- **Internal tool only.** Single-tenant, no billing, no public routes in Phase 1.

---

## Repo structure (authoritative)

```
/app                          # Next.js App Router
  /(auth)/login
  /dashboard                  # property grid
  /properties/new             # property setup screen
  /properties/[id]             # property detail (photos, rooms, theme)
  /properties/[id]/theme       # project theme picker (budget + aesthetic)
  /properties/[id]/rooms/[roomId]/brief    # room brief (moodboard + creative direction)
  /properties/[id]/rooms/[roomId]/studio   # mockup studio (keystone)
  /api/properties/[id]/theme
  /api/rooms/[id]/brief
  /api/rooms/[id]/brief/history
  /api/rooms/[id]/moodboard/upload-sign
  /api/rooms/[id]/moodboard/sign-view
  /api/render/generate
  /api/render/edit             # Session 6 conversational-edit stub (501)
  /api/renders/[id]
  /api/renders/[id]/review

/lib
  /briefs/                    # THE data contract (replaced lib/specs/*)
    schema.ts                 # Zod: ProjectThemeSchema, RoomBriefSchema, CategoryMoodboardSchema
    room-types.ts             # RoomTypeEnum (13 types) + labels
    categories.ts             # CATEGORIES_BY_ROOM (moodboard categories)
    questions.ts              # QUESTIONS_BY_ROOM (creative-direction prompts)
    themes.ts                 # THEME_PRESETS + BUDGET_TIER_OPTIONS
    prompt-input.ts           # RenderPromptInput + buildRenderPromptInput + summarizeBriefForPrompt
    load.ts                   # loadPromptInput — joins property+room+brief+theme under RLS
  /properties/
    property.ts               # CreatePropertyInput / PatchPropertyInput / formatUsd
    buyer-personas.ts         # BuyerPersonaEnum + labels
  /claude/
    prompts.ts                # buildRenderPromptRequest + buildPromptReviewRequest + buildRenderReviewRequest
    client.ts                 # Anthropic SDK wrapper + model slugs
  /gemini/
    client.ts                 # Gemini SDK wrapper + generateImage()
    prompts.ts                # buildContentsArray (base + references + text)
    edit-prompts.ts           # buildEditPrompt for conversational edits
    references.ts             # ReferenceFileReader, localFsReader, supabaseStorageReader
  /render/
    pipeline.ts               # runGeneratePipeline (Sonnet -> Opus -> Gemini -> Opus)
    types.ts                  # Pipeline types
  /supabase/
    client.ts                 # browser client
    server.ts                 # server client (cookie-scoped)
    admin.ts                  # service-role client (bypasses RLS)
    signed-urls.ts            # batch-sign helpers

/components
  /theme/                     # Screen 1: project theme picker
    theme-form.tsx
    budget-tier-picker.tsx
    theme-preset-picker.tsx
    theme-nudge-banner.tsx
  /brief/                     # Screen 2: room brief (moodboard + questions)
    brief-form.tsx
    moodboard-grid.tsx
    moodboard-category-tile.tsx
    creative-questions.tsx
    non-negotiables.tsx
    brief-history-dialog.tsx
  /mockup-studio/             # 3-panel studio layout
    studio-workspace.tsx
    brief-sidebar.tsx
    moodboard-panel.tsx
    render-canvas.tsx
    review-notes.tsx
  /ui/                        # shadcn primitives (Base UI variant)

/supabase/migrations/         # SQL migrations in order (0001 -> 0004)

/scripts
  /test-prompts.ts            # Sonnet + Opus-prompt-review harness
  /run-render-e2e.ts          # Full pipeline E2E (bypasses HTTP auth)
  /test-nano-banana.ts        # Direct Gemini probe (hand-written prompt)
  /validate-opus-reviewer.ts  # Opus prompt-review efficacy (N repeats)
  /edit-nano-banana.ts        # Gemini conversational-edit harness

/test-fixtures
  /vincent-ave-kitchen.ts     # Canonical brief + theme + prompt-input fixture
  /_legacy/                   # Retired RoomSpec fixtures (excluded from tsc)
```

---

## Rules — do not break without asking

1. **`lib/briefs/schema.ts` is the data contract.** Every render, every downstream artifact traces back to a `ProjectTheme` + `RoomBrief`. Do not modify these schemas or `category_moodboards` shape without my explicit approval. Extending with nullable optional fields is fine.

2. **All Claude prompt text lives in `lib/claude/*`.** UI code never contains prompt strings. If you need a new prompt, add a builder function alongside the existing ones and export it.

3. **Briefs are versioned, not edited in place.** Saving a brief inserts a new `room_briefs` row with `version = max + 1`. Never UPDATE an existing brief row. Renders load the latest version at generate time.

4. **Supplier data is local in Phase 1.** Live supplier APIs are Phase 3.

5. **Never hardcode Anthropic or Gemini API keys.** Read from `process.env.ANTHROPIC_API_KEY` and `process.env.GEMINI_API_KEY`. The app should fail loudly at startup if either is missing.

6. **Server-side only for API calls.** Anthropic and Gemini calls happen in `/api/*` routes, never in client components. Render outputs write to Supabase Storage and return signed URLs.

7. **Strict TypeScript, strict Zod.** Every API route validates input with Zod. Every LLM JSON response parses through a Zod schema before hitting the database. Never trust unparsed LLM output.

8. **No magic. No cleverness.** This is an internal tool used by one designer. Prefer boring, legible code. Skip abstractions until we have three concrete instances of the same pattern.

9. **Model routing is role-based, not task-based.** When adding a new Claude call, decide: is this a generator (goes to `CLAUDE_OPERATOR_MODEL` — Sonnet) or a verifier/reviewer (goes to `CLAUDE_REVIEWER_MODEL` — Opus)? Don't upgrade a generator to Opus for quality — improve the prompt first. Don't downgrade a reviewer to Sonnet for cost — the whole point of the reviewer role is that verification stakes justify it.

10. **Re-validate tool/model selection when the task profile changes (Phase 2+ meta-rule).** When a new stage has a task profile meaningfully different from prior stages, run a fresh validation gate on tool/model selection before building on it. Validated tools for one task are not automatically correct for another. Examples: mockup rendering (Phase 1) ≠ staging (Phase 2 Stage 5) ≠ dimensional construction renders (Phase 2 Stage 4). Gemini 2.5 Pro Image is the right answer for spec-fidelity mockups; that does not mean it's the right answer for furnishing an empty room for MLS, or for producing SketchUp-constrained build renders. Each stage gets its own validation session before the toolchain is locked in.

---

## Out of scope for Phase 1 (don't build these)

- Moodboards (Stage 1 of the full workflow)
- Construction-ready renders with SketchUp/ControlNet (Stage 4)
- MLS staging pipeline (Stage 5)
- Investor portfolio pages (Stage 6)
- Multi-user, RBAC, billing
- CompanyCam API integration (designer uploads manually)
- Airtable two-way sync
- Email, notifications, Slack
- Public share links
- Element masking / mask-based inpainting (Gemini conversational editing replaces it)
- Flux, SDXL, Replicate, or any other third-party image model beyond Gemini

---

## Phase 1 success criteria

The tool is "done" for Phase 1 when the designer can:

1. Create a property, upload before-photos, tag them by room
2. Set a project theme (budget tier + aesthetic preset)
3. Fill a room brief: upload moodboard images per category, answer open-ended creative questions, state non-negotiables
4. Click "Generate Mockup" and receive a photorealistic render that honors the brief well enough to approve without regen ≥50% of the time on first try
5. Tweak individual elements (backsplash, cabinet color, flooring) without regenerating the whole room
6. See the QA review catch real drift ("backsplash is horizontal, brief calls for vertical stack")
7. Approve and store the render, associated with the property, for later use

When that flow works end-to-end on a real Vincent Ave room, Phase 1 ships.

---

## Brand / naming context (use in copy, not code)

- Tool name: **Everyday Studio** (part of FRNK Holdings' Everyday brand family: Everyday Build Co., Everyday Homebuyers, Everyday Property Management)
- Parent entity: **FRNK Holdings LLC**
- Tone: professional, quiet, confident. Not playful. Not "AI-forward." The product is a design tool, not a chatbot.

---

## Budget tier conventions

Set explicitly on the project theme (`project_themes.budget_tier`). Options: `builder_grade`, `mid_tier`, `high_end`, `luxury`, `custom`. Defined in [`lib/briefs/themes.ts`](lib/briefs/themes.ts) → `BUDGET_TIER_OPTIONS`:

- **builder:** Home Depot / Menards / Lowe's. Sub-$200 faucets. LVP. White paint.
- **mid:** Home Depot premium + mid Ferguson. $200–500 faucets. Engineered hardwood or premium LVP. Named SW colors.
- **high:** Ferguson mid, Rejuvenation, Schoolhouse. $400–800 faucets. Real hardwood, zellige, quartz. Designer paint.
- **luxury:** Ferguson premium, unlacquered brass, marble, custom cab. Designer overrides freely.

Most Twin Cities flips under FRNK will be **mid** or **high**.

---

## Suppliers we have trade accounts with (prefer these in Suggest output)

Home Depot, Lowe's, Menards, Ferguson, Sherwin-Williams, Benjamin Moore, Fastenal, Rejuvenation, Schoolhouse.

Skip Wayfair unless nothing else fits — returns and consistency are worse.

---

## Working style preferences

- When running shell commands, show me the output before moving on
- When editing a file, show a diff summary, not the whole file
- When adding dependencies, explain why in one line
- Don't write long comments in generated code — the schema and types should be self-documenting
- Don't add READMEs to every subfolder. One root README is enough.
- If a task would take more than 4–5 tool calls, pause and show me the plan first