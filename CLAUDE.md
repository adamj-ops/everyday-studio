# Everyday Studio — Claude Code Context

Internal design tool for FRNK Holdings' fix-and-flip operations. Used by the in-house interior designer to go from CompanyCam before-photos to on-spec mockups, contractor build sheets, MLS-staged photos, and investor portfolio pages — all from one app.

Phase 1 scope: **Property Setup → Room Spec Builder → Mockup Studio.** Everything else is Phase 2+.

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
  /properties/[id]/rooms      # room list
  /properties/[id]/rooms/[roomId]/spec    # spec builder
  /properties/[id]/rooms/[roomId]/mockup  # mockup studio (keystone)
  /api/claude/suggest-spec
  /api/claude/generate-prompt
  /api/claude/review-render
  /api/render/generate
  /api/render/edit
  /api/properties/[id]
  /api/rooms/[id]
  /api/specs/[id]

/lib
  /specs/schema.ts            # THE Zod data contract — do not break
  /claude/prompts.ts          # render prompt + QA review builders
  /claude/suggest.ts          # field-level Suggest button logic
  /claude/client.ts           # Anthropic SDK wrapper
  /gemini/client.ts           # Gemini SDK wrapper + model constant
  /gemini/prompts.ts          # buildContentsArray (base + references + text)
  /gemini/edit-prompts.ts     # buildEditPrompt for conversational edits
  /gemini/references.ts       # ReferenceMaterial + pluggable file reader
  /supabase/client.ts         # browser client
  /supabase/server.ts         # server client with service role

/components
  /spec-builder/              # structured form with Suggest buttons
  /mockup-studio/             # 3-panel layout
    render-canvas.tsx
    spec-sidebar.tsx
    review-notes.tsx
    references-panel.tsx
  /ui/                        # shadcn primitives

/data
  /suppliers.json             # hardcoded SKU library, Phase 1
  /buyer-personas.json        # persona profiles fed to Claude

/supabase
  /migrations/                # SQL migrations in order

/scripts
  /test-prompts.ts            # prompt validation harness

/test-fixtures
  /vincent-ave-kitchen.ts     # canonical test property
```

---

## Rules — do not break without asking

1. **`lib/specs/schema.ts` is the data contract.** Every render, every contractor sheet, every portfolio page traces back to a `RoomSpec`. Do not modify the discriminated union or add/remove fields without my explicit approval. Extending with nullable optional fields is fine.

2. **All Claude prompt text lives in `lib/claude/*`.** UI code never contains prompt strings. If you need a new prompt, add a builder function alongside the existing ones and export it.

3. **Specs are immutable once locked.** When `room_specs.locked_bool = true`, do not mutate the row. To change a spec, create a new version (insert new row) and point renders at it. Renders store `spec_snapshot_json` so every render traces back to the exact spec that generated it.

4. **Supplier data is local in Phase 1.** Read from `data/suppliers.json`. Do not scrape Home Depot, Ferguson, etc. Live supplier APIs are Phase 3.

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
2. Build a locked spec for a kitchen OR bath OR bedroom using Suggest buttons where useful
3. Click "Generate Mockup" and receive a photorealistic render that matches the spec well enough to approve without regen ≥50% of the time on first try
4. Tweak individual elements (backsplash, cabinet color, flooring) without regenerating the whole room
5. See the QA review catch real drift ("backsplash is horizontal, spec calls for vertical stack")
6. Approve and store the render, associated with the property, for later use

When that flow works end-to-end on a real Vincent Ave room, Phase 1 ships.

---

## Brand / naming context (use in copy, not code)

- Tool name: **Everyday Studio** (part of FRNK Holdings' Everyday brand family: Everyday Build Co., Everyday Homebuyers, Everyday Property Management)
- Parent entity: **FRNK Holdings LLC**
- Tone: professional, quiet, confident. Not playful. Not "AI-forward." The product is a design tool, not a chatbot.

---

## Budget tier conventions

Derived from ARV + rehab ratio in `lib/specs/schema.ts` → `deriveBudgetTier()`:

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