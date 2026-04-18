# Everyday Studio — Phase 2 Scope

Phase 2 picks up after [Session 6](SESSIONS.md) ships the Mockup Studio and the full Vincent Ave kitchen flow (spec → Gemini render → Opus QA → conversational edit → approve) works end-to-end. Phase 1 owns **Stage 2 (Room Spec Builder) + Stage 3 (Mockup Studio)** of the six-stage designer workflow. Phase 2 scopes the four remaining stages listed in [CLAUDE.md "Out of scope for Phase 1"](CLAUDE.md): **Stage 1 Moodboards** (pre-spec), **Stage 4 Construction-ready renders**, **Stage 5 MLS staging**, **Stage 6 Investor portfolio pages** (post-construction). Phase 3+ (live supplier APIs, CompanyCam, Airtable, multi-user, billing) stays out of scope.

This doc is citation-heavy and short. Treat it like [SESSIONS.md](SESSIONS.md): bullets, file links, no hype.

## Stage dependency graph

```
         Stage 1                Stage 4                 Stage 5                Stage 6
       Moodboards          Construction-ready         MLS staging          Investor portfolio
       (pre-spec)              (post-spec,              (post-build,           (post-sale,
                                pre-build)               pre-listing)          public route)
           │                        │                        │                        │
           │ feeds Suggest          │ reads locked           │ reads real            │ rolls up
           │ in Spec Builder        │ room_specs +           │ after-photos +        │ properties +
           ▼                        │ Phase 1 render         │ locked spec           │ renders +
  [Phase 1 Spec Builder]            ▼                        ▼                        │ sale data
                            [Contractor output]      [MLS-ready photos]               ▼
                                                                           [portfolio_pages]
```

- **Stage 1 blocks nothing hard** — Phase 1 Spec Builder already ships without it. Stage 1 is additive: richer seed data for `Suggest`.
- **Stage 4 depends on Phase 1** being shipped (needs a locked `room_specs` row + an approved render to annotate or re-render).
- **Stage 5 depends on Phase 1** for the locked spec (MLS review gate) but is otherwise independent.
- **Stage 6 depends on everything** — it surfaces whichever stages have completed for a property. Build it last.

Stages 1, 4, 5 can run in parallel after Phase 1. Stage 6 is the capstone.

## Total effort estimate

**25–40 Claude Code hours** across all four stages, assuming Phase 1 is shipped and green. Baseline calibration: Session 4 = ~3h, Session 5 = ~5h, Session 6 = ~6h target (see [SESSIONS.md](SESSIONS.md)).

| Stage | Low | High |
|---|---|---|
| Stage 1 — Moodboards | 4h | 6h |
| Stage 4 — Construction-ready | 6h | 12h |
| Stage 5 — MLS staging | 7h | 12h |
| Stage 6 — Investor portfolio | 8h | 10h |

Stage 5 widened from 5–8h to 7–12h to absorb the multi-provider validation gate (Gemini vs. Replicate-hosted candidates) and the paired empty-room export pipeline. Stage 4 range stays wide because dimensional fidelity is unproven.

## Open questions for the owner

All five Phase 2 architecture questions resolved 2026-04-18. Decisions inline in the relevant per-stage sections; key architectural rules surfaced in the cross-cutting section. Resolved decisions of record:

- **Moodboards** → new `moodboards` table + `moodboard_items` join table (not an FK on `reference_materials`).
- **Stage 4 render approach** → Gemini + floor-plan reference + Opus-overlay path approved, gated on a ±10% dimensional-fidelity test before build.
- **Stage 6 auth model** → unguessable slug + `published_bool` + `noindex` meta + `/p/*` robots.txt exclusion.
- **RoomSpecSchema** → no extensions beyond nullable optional. Phase 2 stages create sibling schemas in `lib/specs/`: `MoodboardSchema`, `ConstructionSpecSchema`, `StagingSpecSchema`, `PortfolioPageSchema`.
- **Stage 5 MLS staging** → AI-staged output is the deliverable (not a planning tool). Tool selection is open: Gemini vs. Replicate-hosted candidates (Flux.1 Kontext, interior-design specialists, staging-specific fine-tunes), with dedicated staging services as a fallback only. Winner picked by validation gate, not pre-committed.

---

## Stage 1 — Moodboards

### What it does

Pre-spec inspiration capture. The designer pulls reference images (Pinterest screenshots, supplier swatches, prior-flip photos), labels them, and groups them into a moodboard tied to a *room* before spec lock. The moodboard seeds the `Suggest` calls in the Spec Builder — instead of Sonnet guessing from budget tier alone, it sees the designer's actual visual intent. Concrete job: designer starts a Vincent Ave bath, drags in 6 reference images she pulled this morning, groups them as "Vincent bath — warm moody," then hits Suggest on `tile_surfaces` and gets a materially better first pass.

### Data model implications

The existing [reference_materials table (migration 0001, line 69)](supabase/migrations/0001_initial_schema.sql) already has `scope: 'property' | 'room'`, `storage_path`, and `label`. Session 6 wires it into the render pipeline via the planned `0003_*` migration ([SESSIONS.md Session 6](SESSIONS.md)).

**Approved abstraction (owner 2026-04-18):** new `moodboards` table + `moodboard_items` join table. **Not** an FK on `reference_materials`. The join enables (a) the same reference to live in multiple moodboards (a single zellige sample shows up in both the warm-bath and the muted-kitchen moodboard without duplication), (b) moodboard-specific display ordering, and (c) per-item notes ("use this one for the niche, not the floor"). An FK on `reference_materials` collapses (a) and forces (b)/(c) into either nullable columns on `reference_materials` or string concatenation.

**New schema:** `MoodboardSchema` in [lib/specs/](lib/specs/schema.ts) as a sibling, not an extension to `RoomSpecSchema` (per locked rule, see cross-cutting section).

**Recommended migration (new `0004_moodboards.sql`):**

```sql
create table moodboards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  title text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table moodboard_items (
  id uuid primary key default gen_random_uuid(),
  moodboard_id uuid references moodboards(id) on delete cascade not null,
  reference_material_id uuid references reference_materials(id) on delete cascade not null,
  position int not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (moodboard_id, reference_material_id)
);

create index idx_moodboard_items_moodboard on moodboard_items(moodboard_id, position);

-- RLS: moodboards via room → property → owner; moodboard_items via moodboard.
-- Match the cascading-owner-check pattern at migration 0001 lines 139–147.
```

No changes to [RoomSpecSchema](lib/specs/schema.ts) or `reference_materials`. Moodboards are pre-spec; they feed Suggest but never end up in the locked spec row.

### AI pipeline implications

- **New Sonnet call (operator role per [CLAUDE.md rule 9](CLAUDE.md)).** Extend `lib/claude/suggest.ts` to accept an optional `moodboard_refs: ReferenceMaterial[]` parameter. Image refs pass through to the Sonnet multimodal call the same way Gemini already accepts them via [buildContentsArray](lib/gemini/prompts.ts).
- **New prompt builder** in [lib/claude/suggest.ts](lib/claude/suggest.ts): `buildSuggestWithMoodboardRequest`. Lives alongside the existing `buildSuggestFieldRequest`. Per [CLAUDE.md rule 2](CLAUDE.md), no prompt strings in UI.
- **No new model class.** Sonnet is already multimodal; Gemini already accepts multi-image refs. No Opus reviewer needed on moodboard ingest — the designer curates manually, nothing is shipping to a contractor yet.

### UI surface

- New route: `/app/properties/[id]/rooms/[roomId]/moodboard/page.tsx` (new folder under the existing rooms path).
- Reuse [components/mockup-studio/references-panel.tsx](components/mockup-studio/references-panel.tsx) as the upload zone — same drag-and-drop, same signed-URL fetch pattern from [lib/supabase/signed-urls.ts](lib/supabase/signed-urls.ts).
- New component: `components/moodboard/board-grid.tsx` — a grid with drag-to-reorder (use native HTML5 DnD; skip dnd-kit until there are three use cases per [CLAUDE.md rule 8](CLAUDE.md)).
- Badge on the Property Detail page rooms section: "Moodboard: 6 refs" alongside the existing "Spec v3" badge from Session 5.
- Spec Builder ([components/specs/suggest-popover.tsx](components/specs/suggest-popover.tsx)) reads the active moodboard for the room and includes refs in the Suggest POST body.

### Validation gate

**2-hour experiment before building:** pick one Vincent Ave room that already has a locked spec. Manually assemble 6 reference images on disk. Run a one-off script that calls Sonnet twice for the same field (e.g., `tile_surfaces`): once with refs, once without. Compare `suggested_value` quality by eye.

- **Ship signal:** refs-on produces a materially different, better-grounded suggestion ≥70% of fields tested.
- **Reconsider signal:** no material difference, or Sonnet mentions the refs in `reasoning` but the `suggested_value` is identical.

Secondary validation: **Pinterest is upload-only.** Do not scrape, do not build a browser extension, do not touch the Pinterest API. Screenshot-and-drag is the designer's current workflow and it's fine.

### Effort estimate

**4–6 Claude Code hours.** Migration (~0.5h), CRUD API + RLS (~1h), UI (~2h), Sonnet integration (~1h), validation script (~0.5h). Depends on Phase 1 shipped. Does not block Stages 4/5/6.

---

## Stage 4 — Construction-ready renders

### What it does

A second render pass that gives contractors enough geometric clarity to build from. Phase 1 renders are photorealistic mockups aimed at the designer; Stage 4 output is aimed at the GC — dimensional callouts, finish schedules tied to visible surfaces, and a render that reads as a spec sheet, not a glamour shot. Concrete job: designer approves a Vincent Ave kitchen mockup; clicks "Generate Contractor View"; gets a dimensioned render the GC can price from without asking follow-up questions.

### Data model implications

No `room_specs` changes (per [CLAUDE.md rule 1](CLAUDE.md), we only extend with nullable optional fields). The contractor-view render is a sibling of the designer mockup, not a new spec.

**Extensions to `renders`:**

- Add `render_kind text not null default 'designer_mockup' check (render_kind in ('designer_mockup', 'contractor_view', 'mls_staged'))` — covers Stage 4 and Stage 5 with one column.
- Add `parent_render_id uuid references renders(id)` so a contractor view can point at the designer mockup it derived from. Already have `base_photo_id`; this is distinct.
- `room_spec_id` from the planned Session 6 `0003_*` migration ([SESSIONS.md Session 6 data-model note](SESSIONS.md)) stays authoritative.

New sibling table for annotations: `render_callouts` — `{ render_id, x_pct, y_pct, label, source_field }`. Keeps the annotation layer overlay-able and queryable for contractor sheet export later.

### AI pipeline implications

**Approved path (owner 2026-04-18): Gemini + floor plan + Opus overlay. SketchUp + ControlNet dropped.** Conditional on the dimensional-fidelity validation gate below.

Session 2 validated Gemini at ~92% spec fidelity ([SESSIONS.md Session 2](SESSIONS.md)). That's the anchor. "Gemini wasn't enough because X" is not yet demonstrated, and the [CLAUDE.md rule 6 (no third-party image models beyond Gemini)](CLAUDE.md) plus [the Red Flags list in SESSIONS.md](SESSIONS.md) both argue against introducing SketchUp or ControlNet speculatively.

Three options evaluated, pick one:

1. **(Recommended) Gemini re-render with floor-plan reference + Opus callout overlay.** Designer uploads a measured floor plan (sketched on paper, phone photo, or exported from any CAD tool) as a new reference material. New prompt builder `buildContractorRenderPromptRequest` emphasizes dimensional callouts, simplified lighting, annotated appliance footprints. After Gemini renders, Opus generates a JSON callout list (`render_callouts` rows) from the spec — the UI overlays them as SVG on top of the Gemini PNG. Honest about dimensions (they come from the designer's floor plan, not from Gemini). Two new Claude calls, both sit on the existing operator/reviewer split per [CLAUDE.md rule 9](CLAUDE.md): Sonnet generates the render prompt, Opus generates the callout list.
2. **True CAD pipeline (SketchUp API / IFC / Revit).** Orders of magnitude more scope. Needs a new env var, new dependency, new file format. Rejected for Phase 2 unless option 1 fails validation.
3. **Annotated-render only (no re-render).** Reuse the Phase 1 designer mockup unchanged; overlay Opus-generated SVG callouts. Cheapest, but the GC gets a design render with labels, not a contractor render. Viable fallback if option 1 shows Gemini can't shift tone on command.

**New prompt builders** (both in `lib/claude/prompts.ts` alongside existing ones, per [rule 2](CLAUDE.md)):

- `buildContractorRenderPromptRequest({ spec, context, base_photo_description, floor_plan_ref })` → Sonnet → `{ prompt, notes }`.
- `buildCalloutsRequest({ spec, render_image, preserved_elements })` → Opus → `{ callouts: Callout[] }` (Zod-validated).

### UI surface

- New route: `/app/properties/[id]/rooms/[roomId]/contractor/page.tsx`.
- Reuse the three-panel studio layout from Session 6: [components/mockup-studio/spec-sidebar.tsx](components/mockup-studio/spec-sidebar.tsx), [render-canvas.tsx](components/mockup-studio/render-canvas.tsx), [review-notes.tsx](components/mockup-studio/review-notes.tsx).
- New component: `components/contractor-view/callout-overlay.tsx` — SVG overlay on top of the render canvas, click-to-edit a callout's text.
- Export button: "Download contractor PDF" — render + callouts + finish schedule table pulled directly from the locked spec. PDF generation stays server-side in a new `/api/contractor/export` route; no client-side PDF libs.

### Validation gate

**2-hour experiment before building. Modeled on [Session 2.5 Opus-review efficacy](SESSIONS.md) — measure the specific behavior that determines whether the chosen path is viable, not vibes.**

Take the Vincent Ave kitchen's locked spec + a hand-sketched floor plan photo with **known measured ground-truth dimensions** (cabinet runs, island length, appliance bays). Run a one-off script that calls Gemini with the existing `buildRenderPromptRequest` plus a "this is a contractor-view pass, emphasize dimensions and finishes, skip mood lighting" system prompt override. Attach the floor plan as a reference material via the existing [loadReferenceForGemini](lib/gemini/references.ts) path. Send the output to Opus with a prototype `buildCalloutsRequest` that includes the measured dimensions in the system prompt. Inspect the resulting callout JSON: for each measured element, compare Opus's stated dimension against ground truth.

- **Ship signal (option 1):** measured elements in the Opus callout JSON are within **±10% of ground truth** on ≥80% of measurable surfaces, AND the Gemini render is visibly different from the designer mockup (flatter lighting, cleaner geometry). Proceed with option 1.
- **Reconsider signal:** dimensional error exceeds ±10% on more than 20% of surfaces, OR Gemini output is indistinguishable from the designer mockup. Fall back to option 3 (annotated-render only — Opus pulls dimensions directly from the locked `room_specs.dimensions` field, no Gemini guessing). **Do not** escalate to option 2 (CAD) without explicit owner approval — that's the biggest scope creep risk in Phase 2.

The ±10% threshold matches the precision a GC needs to price from drawings without follow-up. Tighter than ±10% is a CAD problem; looser is unusable. Same single-metric discipline that Session 2.5 used to validate the Opus reviewer band.

### Effort estimate

**6–12 Claude Code hours.** Wide because validation controls the branch taken. Option 1 target: ~8h (migration 0.5h, API 2h, new prompt builders 1.5h, callout overlay UI 2h, PDF export 2h). Option 3 fallback: ~5h (skip Gemini re-render, skip Sonnet builder, keep Opus callouts + overlay + PDF). Depends on Phase 1.

---

## Stage 5 — MLS staging pipeline

### What it does

Post-construction, pre-listing. Designer uploads after-photos of the actual finished room; the tool generates lightly-staged variants (rug, throw pillows, art, plants) and **the staged image is the MLS listing photo**. Not a planning aid, not a moodboard — the deliverable. Keep everything the GC built (cabinets, tile, paint, fixtures, flooring) and add only soft furnishings.

**Business framing (owner 2026-04-18):** physical staging runs $3–5K per property; across ~20 properties/year FRNK ships, that's $60–100K in eliminated cost. AI staging with proper Northstar MLS disclosure is the direction. Northstar MLS requires every virtually-staged photo to be paired with the un-staged original and disclosed in the listing — Stage 5 surfaces both as first-class outputs.

Concrete job: Vincent Ave kitchen is done, photographer sent 8 after-photos; designer uploads one, clicks "Stage for MLS," picks from 3 variants, approves, downloads a paired ZIP — the staged JPG + the empty-room JPG + the pre-filled disclosure text — ready for the listing agent to upload to MLS.

### Data model implications

- Add `'mls_staged'` to `renders.render_kind` (see Stage 4 — same column covers both).
- New table `after_photos` (parallel to `property_photos` but post-construction): `{ id, room_id, storage_path, photographer_credit, captured_at }`. Keeping before and after separate avoids overloading `property_photos.room_label` semantics and lets the Phase 1 photo grid stay focused on before-photos for rendering.
- New table `mls_listings` (one per property; lightweight): `{ id, property_id unique, virtual_staging_disclosure text not null, created_at, updated_at }`. The `virtual_staging_disclosure` field defaults to a pre-filled Northstar MLS-compliant string (e.g., "Photos in this listing have been virtually staged. Furniture, accessories, and décor depicted are not included with the property. Original un-staged photos available on request and accompany this listing per Northstar MLS Rule 7.X."). Designer can edit before publish.
- Each `renders` row with `render_kind = 'mls_staged'` carries `parent_render_id` pointing to the un-staged paired export (auto-generated empty-room JPG; see UI surface). One row per staged image, one row per paired empty export — both persisted, both downloadable.
- New schema `StagingSpecSchema` in [lib/specs/](lib/specs/schema.ts) as a sibling — captures staging style (`minimal | medium | rich`), preserved-elements list, and the prompt seed. **No** `RoomSpecSchema` modifications.
- The locked `room_specs` row becomes a *review reference* — the Opus reviewer gets the spec + the MLS-staged render and verifies "nothing built was modified." The spec is not the source material; the after-photo is.

### AI pipeline implications

**Tool selection is open.** Gemini was the right call for Phase 1 mockup rendering (whole-room transformation); MLS staging is a different task profile (object addition to a preserved environment) and was never validated against it. Resolved by the head-to-head validation gate below, not pre-committed.

Candidates being evaluated:

1. **Gemini 3 Pro Image Preview** — current Phase 1 renderer ([lib/gemini/client.ts](lib/gemini/client.ts)). Validated at ~92% fidelity for whole-room transformation in [Session 2](SESSIONS.md). Object-addition-to-preserved-environment is not yet validated. Cheapest integration — already wired.
2. **Replicate-hosted models.** Originally dropped in Phase 1 ([SESSIONS.md Session 2](SESSIONS.md)) when Gemini won mockup rendering. Worth reconsidering for Stage 5 because (a) staging is a different task than mockup rendering, (b) Replicate's catalog has grown — Flux.1 Kontext (production-ready conversational edit), staging-specific fine-tunes, interior-design specialist models. The `REPLICATE_API_TOKEN` env var already exists in `.env.example` from early Phase 1 planning, so re-introducing it doesn't require new secrets infrastructure.
3. **Dedicated staging services** — BoxBrownie, Virtual Staging AI, Styldod. $20–60 per image with human review. **Fallback only** if AI-only options fail validation. Slower (hours-to-days turnaround), pricier per image, not API-native.

**Architectural implication:** Phase 2 may reintroduce Replicate as a second image provider alongside Gemini. **Model routing becomes task-based, not single-provider** — mockup rendering → Gemini, staging → validated winner. Add `lib/replicate/client.ts` only if Replicate wins the gate; otherwise the existing `lib/gemini/` is enough. Either way, [CLAUDE.md rule 6](CLAUDE.md) gets a Stage-5-specific carve-out (see red flags) — Gemini-only stays the rule for mockup rendering.

**Claude calls (operator/reviewer split per [rule 9](CLAUDE.md), unchanged regardless of which image model wins):**

- **Sonnet operator** — new `buildStagingPromptRequest({ after_photo_description, room_type, staging_style })` in [lib/claude/prompts.ts](lib/claude/prompts.ts) → `{ prompt, notes }`. Hard-coded discipline: "Preserve all built elements exactly. Add only: area rug, pillows, wall art, plants, small countertop objects. Do not repaint, do not change flooring, do not reshape cabinets." Same prompt shape feeds whichever image model wins.
- **Opus reviewer** — new `buildStagingReviewRequest({ locked_spec, after_photo, staged_render })` → `{ verdict, preserved_elements_check, staging_quality, flagged_drift }`. Output ships publicly (MLS); Opus gate is the right call. Drift detection (e.g., model silently repainting a wall) is exactly what reviewer role catches.

### UI surface

- New route: `/app/properties/[id]/rooms/[roomId]/mls/page.tsx`.
- New component: `components/mls-staging/after-photo-gallery.tsx` — grid of after-photos with per-photo "Stage" button.
- Reuse [render-canvas.tsx](components/mockup-studio/render-canvas.tsx) and [review-notes.tsx](components/mockup-studio/review-notes.tsx) unchanged. The spec-sidebar pivots to show "preserved elements checklist" instead of the full spec.
- Multi-variant generation: one "Stage" click calls the chosen image model 3 times in parallel with slightly different prompts (minimal / medium / rich staging). Designer picks one. Keep all three rows in `renders`; mark the picked one with a `selected_bool` column.
- **Paired empty-room export (compliance requirement).** Every approved staged image auto-generates a paired un-staged export. For Gemini-edited variants the empty-room photo is the original after-photo upload (no work); for any image-model that re-renders the whole frame, the un-staged paired export is the original after-photo, surfaced alongside. Both files persist as downloadable JPGs with no watermarks.
- New route or sub-page: `/app/properties/[id]/mls/disclosure` — edit `mls_listings.virtual_staging_disclosure` text. Pre-filled with the Northstar MLS-compliant default; designer edits if their listing agent has specific wording.
- "Download MLS bundle" button — signed-URL ZIP containing: staged JPG, paired empty-room JPG, `disclosure.txt`. Listing agent uploads the bundle to MLS as one unit. No watermarks on any image.
- **Note for Stage 6:** investor portfolio pages are not MLS-regulated and can use the staged photos freely without the disclosure pairing. Stage 6 reads `renders.render_kind = 'mls_staged'` rows directly.

### Validation gate

**Head-to-head experiment before building any UI. Bigger than the other Phase 2 gates because the tool selection itself is what's being decided.** Budget: ~3 hours, runs as a one-off script per candidate.

Pick **3 real Vincent Ave empty-room after-photos** (or comparable real flip after-photos). Write one identical staging prompt by hand — "preserve everything, add an area rug, two throw pillows on the island stools, a small bowl of lemons on the counter, one plant in the corner." Run the same prompt through every candidate model:

- Gemini 3 Pro Image Preview (existing pipeline)
- Flux.1 Kontext (Replicate)
- 1–2 Replicate interior-design or staging-specific fine-tunes (pick highest-rated current models at run time, no pre-commitment)

For each candidate × each photo, evaluate on six dimensions:

1. **Base environment preservation** (no repainting, no flooring change, no cabinet reshape, no fixture swap) — pixel-diff the preserved regions against the source
2. **Photographic realism** (does the staged photo look like a real photo, not an AI artifact?)
3. **Scale and proportions** (are the rug, pillows, plant scaled correctly to the room?)
4. **Style fidelity** (does the staging match the staged-style prompt? minimal vs. medium vs. rich)
5. **Cost per render** (Gemini vs. Replicate per-image API cost — matters at 20 properties × ~10 rooms × 3 variants/room/year)
6. **Buyer-acceptance readiness for the Twin Cities flip market** (gut check from the designer — would this photo move a listing or look fake?)

- **Ship signal:** one model wins ≥4 of 6 dimensions across ≥2 of 3 photos. Pick that model. Build Stage 5 with task-based routing wiring it in alongside Gemini.
- **Reconsider signal:** no candidate wins decisively. Either narrow scope (start with one room type, accept lower fidelity in v1) or escalate to dedicated staging services as a fallback. Owner call.

### Effort estimate

**7–12 Claude Code hours.** Wider than the original 5–8h to absorb the multi-provider gate and the paired-export pipeline.

Migration + `after_photos` + `mls_listings` CRUD (~2h), new prompt builders + Opus review (~1.5h), parallel multi-variant rendering with task-based routing (~1.5h, +1h if Replicate wins and a `lib/replicate/client.ts` shim is needed), UI including paired-export and disclosure editor (~2.5h), MLS bundle ZIP download (~0.5h), head-to-head validation script (~1h). Depends on Phase 1. Does not block Stage 4 or Stage 6.

---

## Stage 6 — Investor portfolio pages

### What it does

Public-facing pages summarizing a flip — property card, before/after pair per room, spec highlights, ARV, sale price, designer note. One page per property. Concrete job: property closes; designer publishes the portfolio page; FRNK sends the URL to LPs; page loads fast, looks like the Everyday brand, has no login, and surfaces only what the designer chose to show.

### Data model implications

**New tables (new migration):**

- `portfolio_pages`: `{ id, property_id unique, slug text unique not null, published_bool default false, sale_price numeric, designer_note text, hero_render_id uuid references renders(id), created_at, updated_at }`.
- `portfolio_room_entries`: `{ id, portfolio_page_id, room_id, before_photo_id, after_render_id (or after_photo_id for Stage 5 outputs), display_order int, highlights_json jsonb }`. The `highlights_json` blob is a curated subset of the spec — not the whole spec — designer picks 3–5 fields to surface.

**Approved auth model (owner 2026-04-18):** unguessable slug + `published_bool` + `noindex` meta tag + `/p/*` excluded in `public/robots.txt`. Pages are accessible by direct link only; never indexed by search engines. Cheap to add now, hard to retrofit if portfolio pages get scraped or surface in Google for a property address. No password, no auth — slug entropy carries the access control.

**RLS pivot** — this is the first time the owner-scoped-through-`properties` pattern ([migration 0001 lines 116–166](supabase/migrations/0001_initial_schema.sql)) breaks down. New policy: `portfolio_pages` allows public read when `published_bool = true`; writes stay owner-scoped. Worth calling out in the red flags — this is a new pattern the codebase has not used.

New schema: `PortfolioPageSchema` in [lib/specs/](lib/specs/schema.ts) as a sibling. No `RoomSpecSchema` changes. `highlights_json` is a separate curation artifact, not a spec mutation.

### AI pipeline implications

- **New Sonnet call (operator):** `buildPortfolioCopyRequest({ property, rooms_with_specs, sale_price })` → `{ headline, summary_paragraph, room_captions: RoomCaption[] }`. Generates the marketing-ish copy from structured data. Voice override in the system prompt: FRNK tone — "professional, quiet, confident. Not playful. Not AI-forward" per [CLAUDE.md brand section](CLAUDE.md).
- **Opus reviewer (new):** `buildPortfolioCopyReviewRequest` → `{ verdict, voice_issues, factual_issues, revised_copy? }`. This ships publicly; Opus gate is justified per [CLAUDE.md rule 9](CLAUDE.md). If Opus flags factual drift (e.g., Sonnet writes "custom walnut cabinets" when the spec says Home Depot shaker), regenerate.
- No Gemini work. Portfolio pages are composed of existing renders + photos. No new model class.

### UI surface

- **Internal routes** (owner-scoped):
  - `/app/properties/[id]/portfolio/page.tsx` — build / edit / publish the page.
  - Reuse spec-sidebar pattern for per-room curation (pick which renders, which highlights).
- **New public route:**
  - `/app/p/[slug]/page.tsx` — public portfolio page. First route in the app outside `(auth)` and `/api/*`. Static-render via Next.js static generation (`generateStaticParams` + `revalidate`). Sets `<meta name="robots" content="noindex, nofollow">` in the page head — every portfolio page, no exceptions.
- **`public/robots.txt`** — add `Disallow: /p/` so Google, Bing, etc. never crawl portfolio URLs even if a slug leaks. Belt and suspenders alongside the per-page `noindex` meta.
- **Middleware change** ([SESSIONS.md Session 3](SESSIONS.md) notes middleware redirects unauth `/dashboard` + `/properties/**` to login). Add `/p/**` to the public allowlist.
- New component: `components/portfolio/public-page.tsx` — statically renderable, no client hooks beyond lightbox. Styled to match FRNK's Everyday brand family tone.

### Validation gate

**2-hour experiment before building:** take the finished Vincent Ave kitchen (Phase 1 end-state). Hand-write a portfolio page as a plain Markdown file. Hand-pick 3 before-photos, 3 renders, 4 spec highlights. Show it to the owner.

- **Ship signal:** owner says "this is the artifact we'd send LPs." Static generation is acceptable — portfolio pages rarely change post-publish; revalidate on demand on update.
- **Reconsider signal:** owner wants live data (price updates, sale status changes, etc.) or says the format is wrong. In both cases, reduce scope before coding — either drop the feature or spec a narrower v1.

Secondary validation: **slug-based unguessable URLs + `noindex` meta + `/p/*` robots.txt block, no auth, no password (approved 2026-04-18).** This is the simplest auth model and matches how LP portfolio pages typically work for small shops. The `noindex` + robots block keep portfolio pages out of search results so a leaked slug doesn't surface in a Google search for the property address. If the owner later wants password protection, it's a 1-line addition (`portfolio_pages.access_password_hash`) but defer.

### Effort estimate

**8–10 Claude Code hours.** Migrations + RLS exception (~1.5h), internal curation UI (~2.5h), Sonnet + Opus copy pipeline (~1.5h), public route + static generation (~1.5h), brand styling (~1h), middleware update (~0.5h). Depends on Phase 1 and ideally Stage 5 (so the after-photos are polished). Build last.

---

## Cross-cutting

### Schema / data-contract changes rolled up

- **Locked rule (owner 2026-04-18): no modifications to [`RoomSpecSchema`](lib/specs/schema.ts) beyond nullable optional fields.** Per [CLAUDE.md rule 1](CLAUDE.md). Phase 2 stages create **sibling schemas** in [lib/specs/](lib/specs/schema.ts), not extensions:
  - `MoodboardSchema` — Stage 1
  - `ConstructionSpecSchema` — Stage 4 (callout + dimensional metadata)
  - `StagingSpecSchema` — Stage 5 (staging style + preserved-elements list)
  - `PortfolioPageSchema` — Stage 6
- **All Phase 2 additions live in sibling tables**, not on `room_specs`:
- **New migrations (post-0003):**
  - `0004_moodboards.sql` — `moodboards` table + `moodboard_items` join table.
  - `0005_renders_kind.sql` — `renders.render_kind` + `renders.parent_render_id` + `render_callouts` table.
  - `0006_after_photos.sql` — `after_photos` table + `mls_listings` table (with `virtual_staging_disclosure`) + RLS.
  - `0007_portfolio.sql` — `portfolio_pages` + `portfolio_room_entries` + public-read RLS carve-out.
- **Planned but not reviewed here:** `0003_*` from Session 6 (`renders.room_spec_id` FK + `property-references` Storage bucket) is owned by Phase 1.

### New env vars / dependencies

- **Anthropic + Gemini env vars unchanged.**
- **`REPLICATE_API_TOKEN`** — already declared in `.env.example` from early Phase 1 planning. Becomes live only if Replicate wins the Stage 5 head-to-head gate. If it does, add `lib/replicate/client.ts` mirroring the [lib/gemini/client.ts](lib/gemini/client.ts) shape; otherwise leave the env var dormant.
- **No SketchUp / CAD dependency** assuming the recommended Stage 4 path validates the ±10% threshold.
- **PDF generation** for Stage 4 contractor export — prefer a minimal server-side lib (e.g., `pdfkit`) over heavyweight Puppeteer. Single dependency added, explained in the commit.
- **No new auth provider.** The Stage 6 public route is a policy change + a `noindex` meta + a robots.txt entry, not a new provider.
- **No `BASE_URL` change.** Slug URLs live under the existing Vercel domain.

### Phase 2 red flags

Match the tone and bluntness of the [SESSIONS.md red flags](SESSIONS.md). Concrete pushbacks for the future agent working each stage.

- **All stages:** do not extend [`RoomSpecSchema`](lib/specs/schema.ts). Each Phase 2 stage gets a sibling schema in [lib/specs/](lib/specs/schema.ts) (`MoodboardSchema`, `ConstructionSpecSchema`, `StagingSpecSchema`, `PortfolioPageSchema`). Adding a `staging_hints` or `callouts` field to `RoomSpecSchema` looks innocent and will get caught at review.
- **Stage 1:** do not build a Pinterest scraper, a Pinterest OAuth integration, or a Chrome extension. Designer uploads screenshots. Full stop.
- **Stage 1:** moodboards use the `moodboards` + `moodboard_items` join-table pattern. Do not collapse to an FK on `reference_materials` — the join enables cross-moodboard reference reuse, ordering, and per-item notes that an FK can't.
- **Stage 4:** do not introduce SketchUp, Revit, IFC, ControlNet, or any CAD dependency without an owner call. The Gemini + floor-plan path must fail the ±10% dimensional gate first.
- **Stage 4:** do not invent dimensions. Gemini will hallucinate measurements if asked. Dimensions come from the designer's floor-plan reference or the `room_specs.dimensions` field; the render never sources them.
- **Stage 4:** do not upgrade the callout-generation call from Sonnet to Opus to improve quality. Reviewer role is gating, not generation ([CLAUDE.md rule 9](CLAUDE.md)). If Sonnet callout quality is weak, improve the prompt.
- **Stage 5:** do not modify built surfaces in the staging prompt. The whole point is "soft furnishings only." Any prompt that lets the chosen image model repaint walls gets rejected.
- **Stage 5 carve-out from [CLAUDE.md rule 6](CLAUDE.md):** the rule "no third-party image models beyond Gemini" stays in force for **mockup rendering** (the Phase 1 keystone). Stage 5 (MLS staging) is allowed to introduce Replicate-hosted models if and only if they win the head-to-head validation gate. Model routing becomes task-based: mockup → Gemini, staging → validated winner. Do not generalize this carve-out to other tasks.
- **Stage 5 disclosure compliance:** every staged MLS image must be paired with the un-staged original and the `virtual_staging_disclosure` text. Do not ship a "staged-only" download path — Northstar MLS rules require the pairing.
- **Stage 5 — dedicated staging services (BoxBrownie, Virtual Staging AI, Styldod) are fallback only.** Do not wire them in as the primary path without owner approval. They're a safety net if AI-only options fail validation, not a default.
- **Stage 6:** do not add auth to `/p/[slug]`. Unguessable slug + `published_bool` + `noindex` meta + robots.txt block is the model. Password protection, email-gated downloads, "request access" flows — all Phase 3.
- **Stage 6:** do not omit the `noindex` meta or the `robots.txt` block. Search engines indexing portfolio pages by property address is the worst-case leak; per-page meta + site-wide block is belt-and-suspenders for a reason.
- **Stage 6:** do not build a CMS. `portfolio_pages` and `portfolio_room_entries` with typed Zod-validated fields is enough. No rich-text editor, no block-based content system, no i18n.
- **All stages:** do not scrape supplier sites to enrich portfolio or contractor output ([CLAUDE.md rule 4](CLAUDE.md) — supplier data is local in Phase 1 and Phase 2).
- **All stages:** do not add background workers, queues, or cron. Every Phase 2 flow is synchronous request/response, same as Phase 1 ([SESSIONS.md red flags](SESSIONS.md)).

### Recommended Phase 2 session ordering

Order revised after the Stage 5 multi-provider validation became the heaviest gate in Phase 2.

1. **Session 7 — Stage 1 Moodboards.** Smallest stage; validates the pattern for adding stages without touching the locked schema (sibling-schema rule lands here for the first time). Unblocks better Suggest output for real use.
2. **Session 8 — Stage 4 Construction-ready renders.** Promoted to second. The ±10% dimensional gate is binary and runs cheaply on existing Phase 1 infrastructure (no new image-model wiring). Resolving Stage 4 early keeps the worst-case CAD-fallback decision out of the way before the heavier Stage 5 gate begins.
3. **Session 9 — Stage 5 MLS staging.** Demoted to third. The head-to-head validation across Gemini + 2–3 Replicate candidates is the heaviest gate in Phase 2 and may add a new image provider with a new client shim. Better to land it after Stage 4's render-pipeline experience accumulates and the sibling-schema pattern from Stage 1 is in muscle memory.
4. **Session 10 — Stage 6 Investor portfolio.** Last because it consumes outputs from the other three stages and introduces the first public-route pattern. Building it last means every input it surfaces is already polished.

Each session ends green the same way Phase 1 sessions did: `npx tsc --noEmit`, `npm run build`, `npm run test:prompts`, `npm run validate:opus` all pass ([SESSIONS.md rule](SESSIONS.md)).

### What Phase 2 should validate before building

Mirror the [Sessions 1 / 2 / 2.5 pattern](SESSIONS.md) — kill bad paths cheaply before committing. One pre-build experiment per stage, runnable in roughly one afternoon (Stage 5's gate is the heaviest at ~3h):

1. **Moodboard seed quality (~2h):** Sonnet Suggest with vs. without moodboard refs on 6 real fields. Ship if ≥70% materially better.
2. **Gemini contractor-tone re-render + Opus callouts with measured ground truth (~2h):** Gemini pass with floor-plan reference + tone override; Opus callout JSON. Compare callout dimensions to ground truth. Ship option 1 if output reads as contractor-view AND ≥80% of measured surfaces fall within ±10% of ground truth. Otherwise fall back to option 3 (annotated-render only, no Gemini-sourced dimensions).
3. **Stage 5 head-to-head: Gemini vs. Replicate-hosted candidates (~3h):** 3 real Vincent Ave empty-room after-photos × Gemini + Flux.1 Kontext + 1–2 Replicate interior/staging fine-tunes × identical staging prompt. Score each candidate on environment preservation, photographic realism, scale/proportions, style fidelity, cost per render, and Twin Cities buyer-acceptance. Ship if one model wins ≥4 of 6 dimensions across ≥2 of 3 photos. Otherwise narrow scope or escalate to dedicated staging services as fallback.
4. **Portfolio page format (~2h, no code):** hand-write a Markdown draft of Vincent Ave's portfolio page with real assets. Ship if owner approves the artifact. Otherwise narrow or defer.

Any experiment that fails its ship signal gets escalated to the owner before coding begins — same discipline that killed Flux / SDXL / Replicate from Phase 1 mockup rendering in Session 2 (and may put Replicate back into Stage 5 specifically — task-based routing, not single-provider).
