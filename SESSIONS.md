# Everyday Studio — Phase 1 Sessions

Phase 1 ships the Property Setup → Project Theme → Room Brief (moodboard) → Mockup Studio flow for a single in-house designer. Sessions 1–6 built the original RoomSpec-driven pipeline. Session 7 pivoted the input surface to a moodboard-driven brief after user testing rejected the structured-form approach.

> If you are reading the historical sessions below (1–6) and see references to `lib/specs/*`, `RoomSpecSchema`, `room_specs`, `components/specs/*`, `components/room-spec-form.tsx`, or the `/api/rooms/[id]/spec/*` routes — those are all retired. See Session 7 at the bottom for the live surface.

**Rule:** every session ends green. `npx tsc --noEmit`, `npm run build`, `npm run test:prompts` (Sonnet + Opus), and `npm run validate:opus` all pass. If any harness breaks, fix it before closing the session.

This file is the single source of truth for what ships when.

---

## Session 1 — Validate the prompts — COMPLETE

**Key decisions:**

- [lib/specs/schema.ts](lib/specs/schema.ts) is the locked data contract. Discriminated union on `room_type`.
- `buildRenderPromptRequest` and `buildRenderReviewRequest` return `{ system, user }` objects; responses parsed through Zod.
- [test-fixtures/vincent-ave-kitchen.ts](test-fixtures/vincent-ave-kitchen.ts) is the canonical regression fixture.

---

## Session 2 — Validate Gemini rendering + reference materials — COMPLETE

**Key decisions:**

- Google Gemini 2.5 Pro Image (`gemini-3-pro-image-preview`) is the primary and only rendering model. ~92% spec fidelity across 4 Vincent Ave test renders.
- Conversational text-input editing replaces mask-based inpainting. Session 7 retired.
- Reference Materials is in Phase 1 scope. Gemini accepts multi-image inputs natively.
- Flux/SDXL/Replicate explicitly dropped.
- `lib/gemini/*` ships with a pluggable `ReferenceFileReader` and a local-fs impl; Supabase reader gets wired in Session 3/6.

## Session 2.5 — Opus-review efficacy validation — COMPLETE

- Two-tier architecture validated: Sonnet = operator, Opus = reviewer.
- 80% ship_it rate across 5 fixtures landed in the KEEP band.
- Session 2.5.1 tune (output-discipline rule in the Opus system prompt) suppressed reasoning-as-findings; post-tune, intervention-quality jumped to 100% valid critiques on the one fixture Opus intervened on.
- `CLAUDE_OPERATOR_MODEL=claude-sonnet-4-6` and `CLAUDE_REVIEWER_MODEL=claude-opus-4-7`, overridable via env.

---

## Session 3 — Next.js + Supabase scaffold — COMPLETE

Commit: [`ee85408`](https://github.com/adamj-ops/everyday-studio/commit/ee85408) (+ `972d423` housekeeping).

**What shipped:**

- Next.js 14.2 App Router + Tailwind v3 + shadcn 3.x (`base-nova` preset, `neutral` palette, CSS variables). Shadcn's Base UI primitives, not Radix — this matters for Popover/Dialog/Accordion prop shapes (`multiple` instead of `type="multiple"`, no `asChild`, etc.).
- Supabase clients: [lib/supabase/client.ts](lib/supabase/client.ts), [lib/supabase/server.ts](lib/supabase/server.ts), [lib/supabase/admin.ts](lib/supabase/admin.ts).
- Migration live on `nxdeoyvudfwhjnmqtjcg`: [supabase/migrations/0001_initial_schema.sql](supabase/migrations/0001_initial_schema.sql). Tables: `properties`, `property_photos`, `rooms`, `room_specs`, `reference_materials`, `renders`. RLS on all 6 with owner-scoped policies. `buyer_persona` and `room_type` columns are plain `text` — Zod owns enum validation at the API boundary.
- Auth: functional email/password via Next server actions. Middleware refreshes sessions and redirects unauth `/dashboard`+`/properties/**` to `/login?next=...`.
- 8 API route stubs returning 501 with Zod input validation + auth gate.
- Vercel: project `opsfx/everyday-studio` linked to GitHub, env vars pushed (7 vars × 3 environments), auto-deploys on push to `main`. Production at [everyday-studio.vercel.app](https://everyday-studio.vercel.app).

**Deviation from spec:** shadcn v3 API has no `--style new-york --base-color zinc` flags. The v3 `base-nova` preset is functionally equivalent.

---

## Session 4 — Property Setup UI — COMPLETE

Commit: [`d13a1fe`](https://github.com/adamj-ops/everyday-studio/commit/d13a1fe).

**What shipped:**

- Dashboard ([app/dashboard/page.tsx](app/dashboard/page.tsx)) with property grid and empty state.
- New Property form ([app/properties/new/page.tsx](app/properties/new/page.tsx)) with Zod-validated server action.
- Property detail page ([app/properties/[id]/page.tsx](app/properties/[id]/page.tsx)) with photo grid and rooms section.
- Photo upload sheet with drag-and-drop + per-photo room labeling.
- Supabase Storage: `property-photos` bucket with RLS via migration [supabase/migrations/0002_storage_setup.sql](supabase/migrations/0002_storage_setup.sql).
- Signed-URL pattern in [lib/supabase/signed-urls.ts](lib/supabase/signed-urls.ts) — mirror for references/renders in Session 6.
- API: `/api/properties` GET/POST/PATCH, `/api/properties/[id]/photos` POST + `/sign`, `/api/rooms` POST.

---

## Session 5 — Room Spec Builder — COMPLETE

Commit: [`4dc2123`](https://github.com/adamj-ops/everyday-studio/commit/4dc2123) (+ follow-up polish commit for chip input and nested-label prominence).

**What shipped:**

- Spec Builder at [app/properties/[id]/rooms/[roomId]/spec/page.tsx](app/properties/[id]/rooms/[roomId]/spec/page.tsx).
- Schema-driven form ([components/room-spec-form.tsx](components/room-spec-form.tsx) + [components/specs/variant-form.tsx](components/specs/variant-form.tsx)). Sections from `sectionsFor(room_type)` in [lib/specs/variant.ts](lib/specs/variant.ts); field types from `<Variant>Schema.shape`.
- Defensive leaf renderer ([components/specs/field.tsx](components/specs/field.tsx)): loop-unwraps `ZodOptional`/`ZodNullable` until a concrete type; handles `ZodObject`, `ZodArray` (chip input for string arrays, repeating cards for object arrays), `ZodUnion` (present/absent toggle for `cabinetry.island`, `living.fireplace`).
- ✨ Suggest popover ([components/specs/suggest-popover.tsx](components/specs/suggest-popover.tsx)) gated to top-level object fields (cabinetry, counters, backsplash, paint, flooring, lighting, vanity, tile_surfaces, appliances, plumbing, fireplace). Scalar fields (room_name, dimensions, estimated_material_cost) don't get Suggest.
- Spec versioning: PUT creates a new `room_specs` row with `version = max+1`. History dialog ([components/specs/history-dialog.tsx](components/specs/history-dialog.tsx)) lists all versions DESC and lets the designer restore one into the form (dirty-tracked, must Save to commit as v+1).
- `lib/claude/suggest.ts` output contract: `{ suggested_value, reasoning }` envelope. Single Sonnet call.
- API: `/api/rooms/[id]/spec` GET (all versions), PUT (new version). `/api/rooms/[id]/spec/suggest` POST → Sonnet → structured response. Token usage logged via `console.log`.
- Property detail page shows `Spec v3` / `Spec: not started` badge per room.

**Deviations from plan:**

- Four-variant-files consolidated into single `variant-form.tsx`. Saved 400+ lines of duplication; kept the file well under the 500-line threshold that would have triggered the split.
- Suggest button is object-level only. Per-leaf ✨ icons on every SKU / supplier-URL / notes field would have cluttered badly without adding value.

**Verification evidence (preserved):** [test-fixtures/session-5-e2e/](test-fixtures/session-5-e2e/) — full API log, first Sonnet `{ suggested_value, reasoning }` payload, annotated screenshot of the form with the Suggest popover open.

---

## Session 6 — Mockup Studio (keystone, Phase 1 ships here) — NEXT

**Goal:** Three-panel mockup studio that generates a Gemini render from the locked room spec, reviews it with Opus, and supports conversational element edits. Phase 1 ships at the end.

**Prerequisites:** Session 5 green (it is). Real property + Vincent Ave kitchen spec saved as v1.

### Known state the next agent must honor

All of these are load-bearing and were decided across Sessions 1–5. Don't relitigate without checking with the owner.

- **Two-tier Claude architecture** (Session 2.5). Sonnet = operator, Opus = reviewer. Both reviewer roles (prompt review + render QA) go to Opus. See [lib/claude/client.ts](lib/claude/client.ts).
- **Render prompt pipeline** — use these helpers as-is, don't rebuild:
  - `buildRenderPromptRequest({ spec, context, base_photo_description, references? })` — Sonnet generates a ~3000–4500 char Gemini-style natural-language prompt returning `{ prompt, notes }`.
  - `buildPromptReviewRequest({ spec, context, base_photo_description, generated_prompt, references? })` — Opus reviews Sonnet's prompt; returns `{ verdict: "ship_it" | "revise" | "regenerate", issues, revised_prompt }`.
  - `buildRenderReviewRequest({ spec, context })` + the image in the user message — Opus reviews the Gemini render; returns `{ overall_match, issues, preserved_elements_check, approved_to_show_designer, summary }`.
  - `buildContentsArray({ basePhoto, references, promptText })` — assembles Gemini `Content[]` with base photo first, refs next, text last. MAX_REFERENCES = 4, throws on overflow.
  - `buildEditPrompt({ instruction, referenceHints? })` — conversational-edit wrapper for edit flow.
  - `generateImage({ contents, model? })` from [lib/gemini/client.ts](lib/gemini/client.ts) — returns `{ imageBase64, mimeType, commentary }`.
- **`lib/gemini/references.ts` has a `TODO(supabase)` marker.** Session 6 MUST implement `supabaseStorageReader`. Signature matches `ReferenceFileReader`: takes a storage path, returns `{ mimeType, dataBase64 }`. Use the existing admin client + a short-lived signed URL + `fetch` + base64 encode.
- **`property-references` Storage bucket does NOT exist yet.** Session 6 creates it via a new migration (`0003_references_bucket.sql` or similar), mirroring the `property-photos` bucket setup in [supabase/migrations/0002_storage_setup.sql](supabase/migrations/0002_storage_setup.sql).
- **Token-usage logging pattern:** mirror Session 5. `console.log` from the API route with room_id/field/tokens. Don't add a DB column yet — the `renders.cost_estimate_cents` column exists if you want to populate it with total Sonnet+Opus+Gemini cents, but cost estimation for Gemini is fuzzy; keep it simple.
- **RLS is owner-scoped through `properties`.** Every API route that touches `renders` or `reference_materials` runs under the SSR client with the user's cookie — reads filtered automatically. For the service-role admin client (signed URLs, cross-cutting inserts), explicit ownership checks are required.
- **Model IDs** come from env vars `CLAUDE_OPERATOR_MODEL`, `CLAUDE_REVIEWER_MODEL`, `GEMINI_IMAGE_MODEL`. Defaults are correct (Sonnet 4.6, Opus 4.7, Gemini 3 Pro Image Preview).

### Data model note that needs resolution before building

The `renders` table from migration 0001 does **NOT** have a `spec_snapshot_json` column, despite the Session 3 opener calling for one. Session 6 must pick one of:

- **Option A (recommended):** add `room_spec_id uuid references room_specs(id)` to `renders` in a new migration. FK to the exact versioned spec used. Clean, queryable, smaller than embedding JSON.
- **Option B:** add `spec_snapshot_json jsonb` as originally spec'd.
- **Option C:** rely on `renders.prompt_text` + creation timestamp to reconstruct which spec was used. Fragile; not recommended.

Recommend Option A and move on. 5-line migration.

### Opening message to paste into the next agent

> Implement the Mockup Studio at `/app/properties/[id]/rooms/[roomId]/studio/page.tsx`. This is the keystone feature of Phase 1. Follow CLAUDE.md strictly.
>
> **Layout — three panels (+ a references panel):**
>
> - Left: [components/mockup-studio/spec-sidebar.tsx](components/mockup-studio/spec-sidebar.tsx) — read-only spec display, latest locked version of the room's `room_specs` row.
> - Center: [components/mockup-studio/render-canvas.tsx](components/mockup-studio/render-canvas.tsx) — shows the latest render (loading state while pending), a "Generate" button, and a text input for conversational edits.
> - Right: [components/mockup-studio/review-notes.tsx](components/mockup-studio/review-notes.tsx) — Opus QA verdict + issues + preserved-elements check + correction hints. Also shows prompt-review verdict and `revised_prompt` diff if Opus intervened.
> - Above the render canvas: [components/mockup-studio/references-panel.tsx](components/mockup-studio/references-panel.tsx) — drag-and-drop upload zone + list of the property's existing reference materials with per-render toggle checkboxes (max 4 checked).
>
> **Migration 0003:** add `room_spec_id uuid references room_specs(id)` to `renders`. Create `property-references` Storage bucket with RLS policies matching `property-photos`. Run `supabase db push`.
>
> **`supabaseStorageReader` in [lib/gemini/references.ts](lib/gemini/references.ts):** replace the `TODO(supabase)` marker. Takes `storage_path`, uses the service-role admin client to sign a short-lived URL, fetches the bytes, returns `{ mimeType, dataBase64 }`. Signature must stay a `ReferenceFileReader` so the test harnesses keep working.
>
> **Generate flow — `POST /api/render/generate`:** accepts `{ room_id, base_photo_id, reference_material_ids?: string[] }`. Steps:
>
> 1. Auth check. Load the latest `room_specs` row for the room (RLS-scoped). Load the base photo and any toggled references.
> 2. Call Sonnet with `buildRenderPromptRequest({ spec, context, base_photo_description, references })` to get `{ prompt, notes }`.
> 3. Call Opus with `buildPromptReviewRequest({ spec, context, base_photo_description, generated_prompt: prompt, references })` to get `{ verdict, issues, revised_prompt }`.
>    - `ship_it` → use `prompt` as-is.
>    - `revise` → use `revised_prompt`.
>    - `regenerate` → one retry of Sonnet with Opus's `issues` as feedback; if the second pass is still `regenerate`, fall back to `prompt` + log a warning. Cap regenerate attempts at 1 per request.
> 4. Load references via `loadReferenceForGemini(ref, supabaseStorageReader)`.
> 5. Build `contents` via `buildContentsArray({ basePhoto, references, promptText: finalPrompt })`.
> 6. Call Gemini via `generateImage({ contents })`.
> 7. Upload the returned `imageBase64` to the `renders` Storage bucket (create it in migration 0003 if needed).
> 8. Insert a `renders` row: `{ room_id, base_photo_id, room_spec_id, prompt_text: finalPrompt, storage_path, status: 'complete' }`.
> 9. Call Opus with `buildRenderReviewRequest({ spec, context })` + the image → persist `opus_verdict` + `opus_critiques_json` on the same row.
> 10. Return `{ render_id, signed_url, opus_review }` to the client.
>
> **Edit flow — `POST /api/render/edit`:** accepts `{ render_id, instruction, reference_material_ids? }`. Loads the prior render as base photo, calls `buildEditPrompt({ instruction, referenceHints: refs.map(r => r.label) })`, builds a contents array, calls Gemini, persists a new `renders` row with the prior render id as context, runs Opus image QA on the new output.
>
> **References API — `/api/references` GET/POST:** finalize the Session 3 stub. POST accepts `{ property_id, room_id?, storage_path, label, scope: 'property' | 'room' }` and inserts a `reference_materials` row. Add a `sign` subroute for signed-URL generation. GET accepts `?property_id=...` to list refs for the property (room_id optional filter).
>
> **No mask editor. No inpainting. Element tweaks are text-input only.** Keep all Anthropic and Gemini calls server-side.

### Exit criteria (Phase 1 ships)

- Designer runs the full Vincent Ave kitchen end-to-end: open spec, click Generate, see the render + Opus verdict, make a conversational edit, see a second render, approve, see both stored against the room.
- First-try approval rate ≥50% on Vincent Ave. Opus image QA catches real drift on visibly-off renders (backsplash orientation, hardware finish, missing preserved elements).
- `npx tsc --noEmit`, `npm run build`, `npm run test:prompts`, `npm run validate:opus` all green.
- Vercel production deploy of the Session 6 commit is live, exercising the full flow end-to-end.

---

## Session 7 — Element tweaks with masking — RETIRED

Gemini conversational editing handles element tweaks via text input; no mask editor needed. Phase 1 ships after Session 6.

---

## Ongoing — maintenance prompts

Snippets for fresh sessions after Phase 1 is live. Each under an hour, no architectural change.

- **Add a new room type.** Extend the discriminated union in [lib/specs/schema.ts](lib/specs/schema.ts) with a new `z.literal(...)` branch and its fields. Update `summarizeSpecForPrompt` in [lib/claude/prompts.ts](lib/claude/prompts.ts). Add a `sectionsFor` case in [lib/specs/variant.ts](lib/specs/variant.ts) and a factory in [lib/specs/defaults.ts](lib/specs/defaults.ts). Add a test-fixture. Run `npm run test:prompts`.
- **Switch Gemini model version.** Update `GEMINI_IMAGE_MODEL` in [lib/gemini/client.ts](lib/gemini/client.ts). Run `npm run test:nano` against `test-fixtures/vincent-before.jpg` and compare side-by-side. If Opus QA verdict drops below "good", roll back.
- **Add a new supplier.** Extend `SupplierEnum` in [lib/specs/schema.ts](lib/specs/schema.ts) and the supplier list. Update `lib/claude/suggest.ts` guidance only if it needs new routing. No scraping.
- **Bump prompt quality.** Edit the relevant builder in `lib/claude/prompts.ts`. Run `npm run test:prompts` before and after, diff the generated output in the commit message.

---

## Red flags — push back on the next agent

Stop and confirm with the owner if the next agent proposes any of these. All out of scope for Phase 1.

- Adding cron, scheduled functions, queues (Redis/BullMQ), or any background workers.
- Refactoring `RoomSpecSchema`, the discriminated union, or any locked schema without approval (CLAUDE.md rule 1).
- Putting prompt strings in UI code. All prompt text lives in `lib/claude/*` (CLAUDE.md rule 2).
- Using an ORM (Prisma, Drizzle, TypeORM). Supabase client + SQL is enough.
- Adding auth providers beyond Supabase email/password.
- Adding analytics, feature flags, or error-tracking SDKs (PostHog, LaunchDarkly, Sentry) in Phase 1.
- Adding a third-party image model beyond Gemini (Flux, SDXL, Replicate, Stability).
- Building a mask editor, inpainting workflow, or pixel-selection UI. Gemini conversational editing is the Phase 1 answer.
- Scraping supplier sites. Supplier data is local (`data/suppliers.json`) in Phase 1.
- Swapping shadcn primitives from Base UI back to Radix. Accept the Base UI prop shapes (`multiple` not `type="multiple"`, no `asChild` on triggers, etc.) and move on.

---

## Session 7 — Moodboard brief rewrite — COMPLETE

**Why:** After real designer use, the structured `RoomSpec` discriminated union felt clinical, not creative. Per-field Suggest buttons fragmented decision-making. The save flow had a nav trap. We pulled the Spec Builder out and replaced it with a moodboard + creative-direction + non-negotiables brief.

**What changed:**

- Migration [0004_moodboard_flow.sql](supabase/migrations/0004_moodboard_flow.sql) adds `project_themes` (one per property) and `room_briefs` (versioned per room). Both RLS-scoped. `room_specs` and `reference_materials` are retained but no longer written.
- New data model under [lib/briefs/](lib/briefs/schema.ts): `ProjectThemeSchema`, `RoomBriefSchema`, `CategoryMoodboardSchema`, plus `CATEGORIES_BY_ROOM` and `QUESTIONS_BY_ROOM` keyed on all 13 DB room types.
- [lib/claude/prompts.ts](lib/claude/prompts.ts) re-engineered: `summarizeSpecForPrompt` replaced by `summarizeBriefForPrompt`. All three builders (`buildRenderPromptRequest`, `buildPromptReviewRequest`, `buildRenderReviewRequest`) now consume `RenderPromptInput` from [lib/briefs/prompt-input.ts](lib/briefs/prompt-input.ts). Sonnet synthesizes from creative answers + moodboard metadata + non-negotiables instead of restating a structured spec.
- Pipeline ([lib/render/pipeline.ts](lib/render/pipeline.ts)) adapted: `runGeneratePipeline` takes `{ input: RenderPromptInput, basePhoto, moodboardImages }`. Two-pass Opus prompt review + image review unchanged.
- API routes: new [theme](app/api/properties/[id]/theme/route.ts), [brief](app/api/rooms/[id]/brief/route.ts), [brief history](app/api/rooms/[id]/brief/history/route.ts), [moodboard upload-sign](app/api/rooms/[id]/moodboard/upload-sign/route.ts), [moodboard sign-view](app/api/rooms/[id]/moodboard/sign-view/route.ts). Updated `/api/render/generate` and `/api/renders/[id]/review` to load via the shared [loadPromptInput](lib/briefs/load.ts).
- UI: new theme picker at `/properties/[id]/theme` ([ThemeForm](components/theme/theme-form.tsx)), brief form at `/properties/[id]/rooms/[roomId]/brief` ([BriefForm](components/brief/brief-form.tsx)), dismissible [ThemeNudgeBanner](components/theme/theme-nudge-banner.tsx) on the property page, studio sidebar swapped to [BriefSidebar](components/mockup-studio/brief-sidebar.tsx).
- Retired: `lib/specs/*`, `lib/claude/suggest.ts`, `components/specs/*`, `components/room-spec-form.tsx`, `/api/rooms/[id]/spec/*`, `/api/references/route.ts`, `/properties/[id]/rooms/[roomId]/spec/page.tsx`. Moved 4 of the original 5 fixtures to `test-fixtures/_legacy/` (excluded from tsc).
- Preserved: all of Session 6 (the render pipeline, mockup studio shell, conversational edit flow wired to `/api/render/edit`). Session 7 only replaces the input shape.

**Follow-up in this session:**

- Rewrote `scripts/test-nano-banana.ts` (direct Gemini probe, hand-written prompt) and `scripts/validate-opus-reviewer.ts` (N repeats of the single brief fixture) against the new types. Both un-excluded from tsc.
- `DialogTrigger` in [brief-history-dialog.tsx](components/brief/brief-history-dialog.tsx) now uses the Base UI `render` callback form to silence a ref warning.
- Docs (this file, README.md, CLAUDE.md, AGENTS.md) swept to repoint live artifacts at `lib/briefs/*`. PHASE-2-SCOPE.md still describes the pre-rewrite plan and needs its own pass before Phase 2 starts.

**Known flags:**

- `reference_materials` and `room_specs` tables remain in the DB but unused. Safe to drop in a future cleanup; leaving them preserves render history.
- Conversational edit is live: [/api/render/edit/route.ts](app/api/render/edit/route.ts) calls [runEditPipeline](lib/render/pipeline.ts) and the studio surfaces it via the "Apply edit" textarea in [render-canvas.tsx](components/mockup-studio/render-canvas.tsx). A singular-fixture rule was added to the Sonnet system prompt in [lib/claude/prompts.ts](lib/claude/prompts.ts) after an observed duplicate-refrigerator render.
- `PHASE-2-SCOPE.md` is written in RoomSpec-era language; the top banner flags this but the stage sections have not been rewritten.
- Render quality could benefit from a Claude-vision pre-step that describes the before-photo before Sonnet writes the prompt (the REMOVE FROM ORIGINAL section is currently written blind since Sonnet doesn't see the photo). Product upgrade, not a bug.

---

## Session 8 — Foundation: hygiene, download, render quality, design spec — COMPLETE

**Goal:** Ship production hygiene (no leaked DB errors to JSON clients, photo signing visibility, Storage rollback + EXIF strip), a studio download button with stable filenames, stronger Sonnet prompt rules for duplicate appliances + layout drift, and an internal design spec for Sessions 9–11.

**What changed:**

- **API responses:** [`lib/api/internal-error.ts`](lib/api/internal-error.ts) pattern — `app/api/**` routes log with `console.error` and return `{ error: "internal_error", code: "<stable_id>" }` instead of raw `PostgrestError` / exception messages. [`app/api/render/generate/route.ts`](app/api/render/generate/route.ts) and [`app/api/render/edit/route.ts`](app/api/render/edit/route.ts) no longer echo `detail` with internal text on synchronous failures.
- **Property page:** [`app/properties/[id]/page.tsx`](app/properties/[id]/page.tsx) logs `signPhotoUrls` failures and shows a one-line amber banner when signing fails.
- **Photo finalize:** [`app/api/properties/[id]/photos/route.ts`](app/api/properties/[id]/photos/route.ts) uses [`createAdminClient`](lib/supabase/admin.ts) + [`lib/photos/strip-metadata.ts`](lib/photos/strip-metadata.ts) (`sharp`) to re-encode each uploaded object in place (strips EXIF/GPS). On `property_photos` insert failure, removes uploaded paths from the `property-photos` bucket.
- **Studio download:** [`components/mockup-studio/render-canvas.tsx`](components/mockup-studio/render-canvas.tsx) — Download button; filename `{addressSlug}_{roomTypeSlug}_{ordinal}.png` via [`lib/properties/slug.ts`](lib/properties/slug.ts). [`app/api/renders/[id]/route.ts`](app/api/renders/[id]/route.ts) returns `ordinal` (count of renders for the room with `created_at` ≤ this row) so polled clients stay accurate after generate/edit.
- **Prompts:** [`lib/claude/prompts.ts`](lib/claude/prompts.ts) — explicit **ROOM LAYOUT PRESERVATION** and **CRITICAL SINGULAR FIXTURE RULE** blocks; enumeration is derived from non-negotiables + `base_photo_description` text. [`components/brief/non-negotiables.tsx`](components/brief/non-negotiables.tsx) asks designers to list existing major fixtures.
- **Tooling:** [`package.json`](package.json) — `npm run lint` (ESLint 8 + `eslint-config-next@14`), `npm run typecheck`. [`.eslintrc.json`](.eslintrc.json) extends `next/core-web-vitals`. Dependency: `sharp`.
- **Docs:** [`docs/design-spec.md`](docs/design-spec.md) (tokens, components, pages, interactions, anti-patterns). [`CHANGELOG.md`](CHANGELOG.md) Session 8 entry.

**Validation:**

- `npm run typecheck`, `npm run lint`, `npm run build` — pass.
- **Render E2E (`tsx scripts/run-render-e2e.ts <room_id> <base_photo_id>`):** not executed in the agent environment (no `ANTHROPIC_API_KEY` / live spend). **Operator:** run against the Vincent Ave kitchen fixture after deploy; compare `test-fixtures/e2e-run-*.png` to prior output. If duplicate fridges or layout drift persist, treat as **Gemini interpretation limits** — prompt-only fixes may be insufficient; prioritize the vision pre-step ([HANDOFF.md](HANDOFF.md) debt).

---

## Session 9 — GC handoff page (print / investor PDF) — COMPLETE

**Goal:** Single document route for contractor handoff and investor deck export: property + theme header, design-direction summary, per-room before/render pairs, creative Q&A, non-negotiables, moodboard thumbnails. No materials list, budget tables, or timeline (separate portal).

**What shipped:**

- **Route:** [`app/properties/[id]/handoff/page.tsx`](app/properties/[id]/handoff/page.tsx) — server-rendered; rooms without a `room_briefs` row are omitted; empty state when no briefs exist.
- **Data:** [`lib/handoff/query.ts`](lib/handoff/query.ts) — `loadHandoffData` batches property, theme, rooms, latest brief per room (max `version`), latest `renders` row per room with `status = 'complete'`, `property_photos`; signs `property-photos`, `renders` (24h TTL), `property-references` (1h). Before-photo pick matches studio (`room.label` / `room_type` on `room_label`, else first photo by `uploaded_at`).
- **PDF:** Option A — [`components/handoff/handoff-print-button.tsx`](components/handoff/handoff-print-button.tsx) calls `window.print()`; user chooses Save as PDF in the browser dialog.
- **Print CSS:** [`app/globals.css`](app/globals.css) — scoped with `body:has([data-handoff-page])`: hide app header, 7.5in max content, letter `@page`, page breaks between room sections via `break-before-page` on the page.
- **Navigation:** Handoff link on [`app/properties/[id]/page.tsx`](app/properties/[id]/page.tsx).

**Notes:**

- **`properties` has no `property_type` column** — header uses **Target buyer** (`buyer_persona`) when set, not a property-type field.
- **Renders filter** uses DB value `complete` (not `completed`).

**Validation:** `npm run typecheck`, `npm run lint`, `npm run build`.

**Follow-up:** If browser print-to-PDF quality is insufficient, consider Option B (`@react-pdf/renderer`) in a later session.

---

## Session 10 — Favorites for moodboard references — COMPLETE

**Goal:** Per-user saved references (`saved_references`) so designers star uploads, reuse the same `storage_path` across briefs without duplicate storage, and manage favorites from a minimal `/favorites` page.

**What shipped:**

- **Migration:** [`supabase/migrations/0005_saved_references.sql`](supabase/migrations/0005_saved_references.sql) — table + RLS (`user_id = auth.uid()`), indexes, `unique (user_id, storage_path)`.
- **API:** [`app/api/favorites/route.ts`](app/api/favorites/route.ts) (GET list with optional `category`, `room_type` — room filter uses `room_type is null OR eq`), POST (validates first path segment is a property the user owns). [`app/api/favorites/[id]/route.ts`](app/api/favorites/[id]/route.ts) PATCH / DELETE. [`app/api/favorites/sign-view/route.ts`](app/api/favorites/sign-view/route.ts) batch-sign paths that appear in the user’s favorites (management UI).
- **Moodboard signing:** [`app/api/rooms/[id]/moodboard/sign-view/route.ts`](app/api/rooms/[id]/moodboard/sign-view/route.ts) also signs paths listed in `saved_references` for the user so reused favorites preview in another room.
- **UI:** [`components/favorites/picker.tsx`](components/favorites/picker.tsx); star + save dialog + “Use a favorite” on [`components/brief/moodboard-category-tile.tsx`](components/brief/moodboard-category-tile.tsx) / [`moodboard-grid.tsx`](components/brief/moodboard-grid.tsx); brief loads favorite path set once in [`components/brief/brief-form.tsx`](components/brief/brief-form.tsx). [`app/favorites/page.tsx`](app/favorites/page.tsx) + [`app/favorites/favorites-client.tsx`](app/favorites/favorites-client.tsx). Header [`components/user-menu.tsx`](components/user-menu.tsx) (Dashboard, Favorites, log out).
- **Taxonomy helpers:** [`lib/briefs/categories.ts`](lib/briefs/categories.ts) — `categoryLabelFromKey`, `ALL_MOODBOARD_CATEGORY_KEYS`. [`lib/favorites/types.ts`](lib/favorites/types.ts), [`lib/favorites/validate-storage-path.ts`](lib/favorites/validate-storage-path.ts).

**Validation:**

- `npm run typecheck`, `npm run lint`, `npm run build` — pass.
- **Operator:** Run migration; `NOTIFY pgrst, 'reload schema';` if PostgREST misses the table. Smoke-test RLS with two users (B must not see A’s rows). Confirm save → star → GET; picker → image appears; delete favorite → existing brief still shows image after refresh.
