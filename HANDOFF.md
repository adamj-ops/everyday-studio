# Everyday Studio — Session Handoff

Pick up here. Complements [CLAUDE.md](CLAUDE.md) (rules), [AGENTS.md](AGENTS.md) (learned facts), and [SESSIONS.md](SESSIONS.md) (change log). This doc is the short version.

## Current focus

Phase 1 through **Session 10** (favorites for moodboard references). Moodboard-driven flow:

1. Property created → optional theme nudge banner appears.
2. **Theme** at [`/properties/[id]/theme`](app/properties/[id]/theme/page.tsx) — budget tier + aesthetic preset, one row per property.
3. **Brief** at [`/properties/[id]/rooms/[roomId]/brief`](app/properties/[id]/rooms/[roomId]/brief/page.tsx) — moodboard uploads per category + creative answers + non-negotiables, versioned; **star** saves to [`/favorites`](app/favorites/page.tsx), **Use a favorite** reuses a stored `storage_path`.
4. **Studio** at [`/properties/[id]/rooms/[roomId]/studio`](app/properties/[id]/rooms/[roomId]/studio/page.tsx) — render, Opus review, conversational edit, **download PNG** (filename uses address slug + room type + render ordinal).
5. **Handoff** at [`/properties/[id]/handoff`](app/properties/[id]/handoff/page.tsx) — printable contractor / investor summary; **Download PDF** uses the browser print dialog (Save as PDF).

Retired: `lib/specs/*`, per-field Suggest, Spec Builder UI, legacy `/api/rooms/[id]/spec/*` and `/api/references`. `room_specs` and `reference_materials` tables stay in DB for history.

## Runbook

```bash
npm install
# copy env template and fill
cp .env.example .env.local  # if present; otherwise ensure these four are set
npm run dev                 # http://127.0.0.1:3000 — prefer 127.0.0.1 over localhost
npm run typecheck           # tsc --noEmit
npm run lint                # next lint
npm run build               # full next build
```

Required `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY` (Google Cloud project with billing + Generative Language API; free-tier keys 429 on image models)

CLI helpers:

- `npm run test:prompts` — Sonnet prompt build against the brief fixture.
- `npm run validate:opus` — N cycles of Sonnet → Opus prompt review.
- `npm run test:nano` — direct Gemini probe (hand-written prompt).
- `tsx scripts/run-render-e2e.ts` — full pipeline E2E bypassing HTTP auth.

## Route map

| Path | Purpose |
|---|---|
| [`/properties/[id]/handoff`](app/properties/[id]/handoff/page.tsx) | GC / investor handoff document (print-to-PDF) |
| [`/api/properties/[id]/theme`](app/api/properties/[id]/theme/route.ts) | GET / POST project theme |
| [`/api/properties/[id]/photos`](app/api/properties/[id]/photos/route.ts) | POST finalize before-photos into `property_photos` |
| [`/api/properties/[id]/photos/sign`](app/api/properties/[id]/photos/sign/route.ts) | POST signed upload URLs for before-photos; rate-limit TODO in route |
| [`/api/rooms/[id]/brief`](app/api/rooms/[id]/brief/route.ts) | GET latest / PUT new version |
| [`/api/rooms/[id]/brief/history`](app/api/rooms/[id]/brief/history/route.ts) | GET all versions |
| [`/api/rooms/[id]/moodboard/upload-sign`](app/api/rooms/[id]/moodboard/upload-sign/route.ts) | Signed PUT for moodboard upload (10/category cap) |
| [`/api/rooms/[id]/moodboard/sign-view`](app/api/rooms/[id]/moodboard/sign-view/route.ts) | Signed GET for display (current room paths + paths in user `saved_references`) |
| [`/api/favorites`](app/api/favorites/route.ts) | GET list / POST save favorite |
| [`/api/favorites/[id]`](app/api/favorites/[id]/route.ts) | PATCH / DELETE favorite row |
| [`/api/favorites/sign-view`](app/api/favorites/sign-view/route.ts) | POST batch signed URLs for favorite paths |
| [`/favorites`](app/favorites/page.tsx) | Manage saved references (grid, filters, edit/delete) |
| [`/api/render/generate`](app/api/render/generate/route.ts) | Full pipeline: load brief → Sonnet → Opus prompt QA → Gemini → Opus image QA |
| [`/api/render/edit`](app/api/render/edit/route.ts) | Conversational edit against a parent render (Gemini + optional Opus image review) |
| [`/api/renders/[id]`](app/api/renders/[id]/route.ts) | GET render status + `signed_url` + **`ordinal`** (version index for download filenames) |
| [`/api/renders/[id]/review`](app/api/renders/[id]/review/route.ts) | Re-run Opus image review against current brief |

## Pipeline touchpoints

```
brief + theme + room → loadPromptInput → Sonnet → Opus (prompt QA) → Gemini → Opus (image QA) → renders row
```

- Input assembly: [`lib/briefs/load.ts`](lib/briefs/load.ts), [`lib/briefs/prompt-input.ts`](lib/briefs/prompt-input.ts)
- Claude prompts: [`lib/claude/prompts.ts`](lib/claude/prompts.ts) (contains the singular-fixture rule — tell Gemini to replace, not add, appliances)
- Claude client: [`lib/claude/client.ts`](lib/claude/client.ts)
- Gemini: [`lib/gemini/client.ts`](lib/gemini/client.ts), [`lib/gemini/prompts.ts`](lib/gemini/prompts.ts), [`lib/gemini/edit-prompts.ts`](lib/gemini/edit-prompts.ts), [`lib/gemini/references.ts`](lib/gemini/references.ts)
- Orchestration: [`lib/render/pipeline.ts`](lib/render/pipeline.ts) (`runGeneratePipeline`, `runEditPipeline`)

Studio UI: [`components/mockup-studio/studio-workspace.tsx`](components/mockup-studio/studio-workspace.tsx), [`render-canvas.tsx`](components/mockup-studio/render-canvas.tsx), [`brief-sidebar.tsx`](components/mockup-studio/brief-sidebar.tsx), [`moodboard-panel.tsx`](components/mockup-studio/moodboard-panel.tsx).

## Data: `saved_references`

Per-user favorites (`user_id` → `auth.users`). `category` stores moodboard **category_key**. `storage_path` points at `property-references`; `unique (user_id, storage_path)`. Deleting a favorite row does not remove storage objects or paths already copied into `room_briefs`.

## Ops and debugging notes

- **After a Supabase migration**, PostgREST caches schema — if REST calls 404 a new table, run `NOTIFY pgrst, 'reload schema';` via SQL. Missed this once with `properties`.
- **Browser HTTP 431** on `localhost:3000` — use `http://127.0.0.1:3000`. Cookie size blows past localhost's header limits.
- **Stale `.env.local`** — the shell exports env on each command; `npm run dev` can inherit an old `GEMINI_API_KEY`. If Gemini auth fails after a key rotation, `unset GEMINI_API_KEY ANTHROPIC_API_KEY` then restart dev.
- **Signup flow in dev** — email confirmation is on. For bots / E2E, use the Supabase Admin API with `email_confirm=true`, then password-grant login.
- **Duplicate appliances in render** — covered by the singular-fixture rule in [`lib/claude/prompts.ts`](lib/claude/prompts.ts). If it regresses, harden the rule first, then use the "Apply edit" box in the studio as a fallback.

## Known debt

- **Prompt-only render fixes may be insufficient** for duplicate appliances or layout drift if Gemini ignores instructions — Session 8 strengthened Sonnet + brief copy; if issues persist in QA, escalate to **vision pre-step** (see below) rather than more prompt churn.
- **Follow-up leak sweep:** `app/actions/*` and [`app/dashboard/page.tsx`](app/dashboard/page.tsx) may still surface `error.message` to the UI; API routes under `app/api/**` were sanitized in Session 8.
- [`PHASE-2-SCOPE.md`](PHASE-2-SCOPE.md) — banner at top, stage sections still written in RoomSpec language. Needs a rewrite before Phase 2 starts.
- `room_specs` and `reference_materials` tables are dead but retained for history; drop in a future migration only after auditing `renders.room_spec_id` usage.
- [`app/api/properties/[id]/photos/sign/route.ts`](app/api/properties/[id]/photos/sign/route.ts) has a `TODO(phase-2)` for rate limiting.
- Sonnet writes the REMOVE FROM ORIGINAL section blind (it doesn't see the before-photo). A Claude-vision pre-step that describes the photo would lift render quality. Product upgrade, not a bug.
- `test-fixtures/_legacy/` intentionally keeps broken imports to retired `lib/specs/*`; files are excluded from `tsc` via [`tsconfig.json`](tsconfig.json). Don't try to "fix" them — archive or delete if you want them gone.

## Plausible next tasks

1. **Session 11:** design elevation — follow [`docs/design-spec.md`](docs/design-spec.md).
2. Rewrite [`PHASE-2-SCOPE.md`](PHASE-2-SCOPE.md) Stage 1 to reflect `room_briefs` is already the moodboard surface; re-check Stages 4–6 against current schema.
3. Add a Claude-vision pre-step for before-photo description feeding into Sonnet.
4. Harden E2E automation: Playwright flow from property creation → theme → brief → render (existing [`scripts/run-render-e2e.ts`](scripts/run-render-e2e.ts) covers pipeline only, not UI).
5. Rate-limit photo/moodboard signed-URL routes before inviting more designers.
6. Clean-drop retired tables in a migration, with a data audit step.
