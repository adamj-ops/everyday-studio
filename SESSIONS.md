# Everyday Studio — Phase 1 Sessions

Phase 1 ships the Property Setup → Room Spec Builder → Mockup Studio flow for a single in-house designer. Five working sessions (3 through 6) plus two completed validation sessions (1, 2). Session 7 is retired — Gemini conversational editing replaces the planned mask editor.

Rule: every session ends green. `npx tsc --noEmit` passes, `npm run test:prompts` passes, `npm run test:nano` still produces a valid render. If any harness breaks, fix it before closing the session. This file is the single source of truth for what ships when.

---

## Session 1 — Validate the prompts — COMPLETE

**Key decisions:**

- `lib/specs/schema.ts` is the locked data contract. Discriminated union on `room_type`.
- `buildRenderPromptRequest` and `buildRenderReviewRequest` return `{ system, user }` objects and produce structured JSON through Zod.
- Vincent Ave kitchen fixture (`test-fixtures/vincent-ave-kitchen.ts`) is the canonical regression fixture for every prompt change.

---

## Session 2 — Validate Gemini rendering + reference materials — COMPLETE

**Key decisions:**

- Google Gemini 2.5 Pro Image (model `gemini-3-pro-image-preview`) is the primary and only rendering model for Phase 1. Validated at ~92% spec fidelity across 4 Vincent Ave test renders.
- Conversational text-input editing replaces the planned mask-based inpainting workflow. Session 7 retired.
- Reference Materials is in Phase 1 scope: designers can drag-and-drop 1–4 reference images per render; Gemini accepts them natively alongside the before-photo.
- Flux, SDXL, and Replicate are dropped from Phase 1. No third-party image model beyond Gemini.
- `lib/gemini/` module exists (client, prompts, edit-prompts, references) with a pluggable `ReferenceFileReader` for Session 3 Supabase wiring.

---

## Session 3 — Scaffold the Next.js app

**Goal:** Stand up the Next.js 14 App Router skeleton with Supabase, shadcn/ui, and stubbed API routes so every subsequent session is pure implementation.

**Prerequisites:**

- Sessions 1 and 2 green.
- `.env.local` has `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`.
- Supabase project provisioned; `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` available.

**Opening message to paste into Claude Code:**

> Scaffold the Next.js 14 App Router skeleton for Everyday Studio. Follow CLAUDE.md strictly.
>
> 1. Initialize Next.js 14 with TypeScript strict, Tailwind, and shadcn/ui (new-york style).
> 2. Install runtime deps: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`, `date-fns`. `@google/genai` and `@anthropic-ai/sdk` are already present — confirm, do not reinstall.
> 3. Create `supabase/migrations/001_init.sql` with tables: `properties`, `property_photos`, `rooms`, `room_specs`, `renders`, `reference_materials`. Include RLS disabled for Phase 1 (single-tenant internal tool). `renders.spec_snapshot_json jsonb` so every render traces back to its exact spec. `reference_materials` rows match `ReferenceMaterialSchema` in `lib/specs/schema.ts` plus `property_id` and `created_at`.
> 4. Create `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server with service role) per the `@supabase/ssr` pattern.
> 5. Replace the `TODO(supabase)` in `lib/gemini/references.ts` with a real `supabaseStorageReader`: signs a short-lived URL from the `property-references` bucket and downloads the bytes into `{ mimeType, dataBase64 }`.
> 6. Stub every API route listed in CLAUDE.md (`/api/claude/suggest-spec`, `/api/claude/generate-prompt`, `/api/claude/review-render`, `/api/render/generate`, `/api/render/edit`, `/api/properties/[id]`, `/api/rooms/[id]`, `/api/specs/[id]`) to return `501 Not Implemented`. Validate inputs with Zod even in the stubs.
> 7. Stub every page under `/app/(auth)/login`, `/app/dashboard`, `/app/properties/new`, `/app/properties/[id]/rooms`, `/app/properties/[id]/rooms/[roomId]/spec`, `/app/properties/[id]/rooms/[roomId]/mockup` with a page title and a `TODO` comment.
> 8. Do not implement any UI beyond stubs. Do not add auth providers beyond Supabase magic link.
>
> Do not refactor `lib/specs/schema.ts` or `lib/claude/prompts.ts`. Do not add cron, queues, Redis, ORM, analytics, feature flags, or error-tracking SDKs.

**Exit criteria:**

- `npm run dev` starts and every stubbed page renders its title.
- `npx tsc --noEmit` passes.
- `npm run test:prompts` and `npm run test:nano` still pass unchanged.
- `lib/gemini/references.ts` has a working `supabaseStorageReader`; the `TODO(supabase)` comment is gone.
- Migration applies cleanly to a fresh Supabase database.

---

## Session 4 — Property Setup screen

**Goal:** Designer can create a property, upload before-photos, and tag each photo by room. No AI on this screen.

**Prerequisites:** Session 3 green.

**Opening message to paste into Claude Code:**

> Implement the Property Setup screen at `/app/properties/new` and the property dashboard at `/app/dashboard`. Follow CLAUDE.md strictly.
>
> 1. Dashboard: a grid of property cards showing address, ARV, rehab budget, buyer persona tag, and status. Empty state with a "New property" CTA.
> 2. Property Setup form fields must match `PropertyContextSchema` exactly: address, ARV, purchase price, rehab budget, buyer persona, neighborhood notes, style direction. Validate with Zod through `react-hook-form` + `@hookform/resolvers`.
> 3. Photo upload: multi-file drag-and-drop into the `property-photos` Supabase Storage bucket. Each uploaded photo gets tagged with a `room_type` and an optional `room_name` in a simple inline editor. Persist to `property_photos` rows referencing the property.
> 4. After save, redirect to `/app/properties/[id]/rooms`, a list of rooms auto-derived from the tagged photos with "Build spec" links.
> 5. Server mutations go through `/api/properties/[id]` (already stubbed in Session 3 — flesh it out). Validate every route with Zod.
>
> No Anthropic calls. No Gemini calls. No Suggest buttons yet.

**Exit criteria:** Designer can create a property end-to-end, upload 10+ before-photos, tag them, and land on a populated `/rooms` page. Typecheck and harnesses pass.

---

## Session 5 — Room Spec Builder

**Goal:** Designer can build a locked `RoomSpec` for a kitchen, bath, or bedroom using structured form fields and a field-level Suggest button backed by Claude.

**Prerequisites:** Session 4 green.

**Opening message to paste into Claude Code:**

> Implement the Room Spec Builder at `/app/properties/[id]/rooms/[roomId]/spec`. Follow CLAUDE.md strictly.
>
> 1. Dynamic form per `room_type` — switch on the discriminated union in `lib/specs/schema.ts`. Kitchen, bath (primary/secondary/powder), bedroom, living/family/dining/foyer/hallway/laundry/office.
> 2. Every field that benefits from it gets a Suggest button. Clicking it calls `/api/claude/suggest-spec` (flesh out the stub) which uses `lib/claude/suggest.ts` to propose a value grounded in the `PropertyContext`, `BudgetTier`, and `buyer_persona`. Input and output both validated with Zod. Only the specific field being suggested gets updated — never the whole form.
> 3. Autosave on blur through `/api/specs/[id]`. Keep `locked_bool` = false while editing.
> 4. "Lock spec" button flips `locked_bool` to true and creates a new version on subsequent changes (insert, never update — CLAUDE.md rule 3).
> 5. Pull supplier defaults from `data/suppliers.json`. Skip Wayfair by default.
>
> Keep all prompt strings in `lib/claude/*`. UI never contains prompt text.

**Exit criteria:** Designer can build a complete Vincent Ave kitchen spec with at least three Suggest buttons exercised, lock it, and see it persist. Typecheck and harnesses pass.

---

## Session 6 — Mockup Studio (keystone)

**Goal:** Three-panel mockup studio that generates a Gemini render from a locked spec, reviews it with Claude, and supports conversational element edits. Phase 1 ships at the end of this session.

**Prerequisites:** Session 5 green. Vincent Ave kitchen spec locked in the real database.

**Opening message to paste into Claude Code:**

> Implement the Mockup Studio at `/app/properties/[id]/rooms/[roomId]/mockup`. This is the keystone feature of Phase 1. Follow CLAUDE.md strictly.
>
> Layout — three panels:
>
> - Left: spec sidebar (`components/mockup-studio/spec-sidebar.tsx`). Read-only rendering of the locked spec.
> - Center: render canvas (`components/mockup-studio/render-canvas.tsx`). Shows the current render, a "Generate" button, and a text input for conversational edits ("Change the backsplash to vertical stack zellige").
> - Right: review notes (`components/mockup-studio/review-notes.tsx`). Shows the Claude QA verdict, issue list, preserved-elements check, and correction hints.
>
> Plus a References Panel (`components/mockup-studio/references-panel.tsx`) above or beside the render canvas: drag-and-drop zone for designer-supplied reference images (zellige swatches, brass patina samples, etc.), each uploaded to the Supabase `property-references` bucket and persisted as a `reference_materials` row. Per-render toggle checkboxes decide which references attach to the next generate/edit call (max 4).
>
> Generate flow — `POST /api/render/generate`:
>
> 1. Load the locked spec, the base photo, and any toggled reference materials.
> 2. Call Claude with `buildRenderPromptRequest({ spec, context, base_photo_description, references })` → natural-language prompt.
> 3. Load each reference via `loadReferenceForGemini(ref, supabaseStorageReader)`.
> 4. Build the Gemini `contents` array with `buildContentsArray({ basePhoto, references, promptText })`.
> 5. Call Gemini via `generateImage({ contents })` from `lib/gemini/client.ts`.
> 6. Store the output image in the `renders` Storage bucket. Insert a `renders` row with `spec_snapshot_json` = the full locked spec at this moment.
> 7. Call Claude with `buildRenderReviewRequest` + the rendered image; persist the verdict alongside the render.
> 8. Return the signed image URL and the review to the client.
>
> Edit flow — `POST /api/render/edit`:
>
> 1. Take `{ render_id, instruction, reference_ids? }`.
> 2. Load the prior render as the base photo; load any selected references.
> 3. Call `buildEditPrompt({ instruction, referenceHints })` and `buildContentsArray(...)`.
> 4. Call Gemini. Store the result as a new `renders` row that points back to its predecessor.
> 5. Run the Claude QA review on the new render.
>
> No mask editor. No inpainting. Element tweaks are text-input only.
>
> Keep all Anthropic and Gemini calls server-side. Never ship keys to the browser.

**Exit criteria (Phase 1 ships):**

- Designer runs the full Vincent Ave kitchen end-to-end: pick a locked spec, generate, inspect the QA verdict, make a conversational edit, generate again, approve, and see the render stored against the room.
- First-try approval rate ≥50% on Vincent Ave. QA review catches real drift (wrong pattern orientation, wrong hardware finish, missing preserved elements).
- `npx tsc --noEmit` passes. Both harnesses still pass.

---

## Session 7 — Element tweaks with masking — RETIRED

Gemini conversational editing handles element tweaks via text input; no mask editor needed. Phase 1 ships after Session 6.

---

## Ongoing — maintenance prompts

Snippets you can paste into Claude Code in a fresh session once Phase 1 is live. Each one should take under an hour and never change architecture.

- **Add a new room type.** Extend the discriminated union in `lib/specs/schema.ts` with a new `z.literal(...)` branch and any branch-specific fields. Update `summarizeSpecForPrompt` in `lib/claude/prompts.ts` to cover it. Add a Room Spec Builder form case in Session 5 code. Add a Vincent-style fixture for regression testing. Run `npm run test:prompts` to confirm the fixture parses.
- **Switch Gemini model version.** Update `GEMINI_IMAGE_MODEL` in `lib/gemini/client.ts`, re-run `npm run test:nano` against `test-fixtures/vincent-before.jpg`, compare the output to the prior known-good render side-by-side. If QA review verdict drops below "good", roll back.
- **Add a new supplier.** Add an entry to `SupplierEnum` in `lib/specs/schema.ts` and a row (or section) in `data/suppliers.json`. Update `lib/claude/suggest.ts` only if Suggest needs new guidance. Do not add scraping.
- **Bump prompt quality.** Edit `buildRenderPromptRequest` in `lib/claude/prompts.ts` — update the system prompt, add or tighten required sections, adjust the length advisory. Run `npm run test:prompts` before and after and keep the diff of the generated output in the commit message.

---

## Red flags — push back on Claude Code

If Claude Code proposes any of these, stop and confirm with the owner before writing code. These are all out of scope for Phase 1 and usually indicate over-engineering.

- Adding a cron job, scheduled function, or background worker.
- Adding Redis, BullMQ, or any queue.
- Refactoring `RoomSpecSchema`, the discriminated union, or any other locked schema without explicit approval (CLAUDE.md rule 1).
- Putting prompt strings in UI code. All prompt text lives in `lib/claude/*` (CLAUDE.md rule 2).
- Using an ORM (Prisma, Drizzle, TypeORM). Supabase client + SQL is enough for Phase 1.
- Adding auth providers beyond Supabase magic link (Clerk, Auth0, NextAuth with multiple providers, etc.).
- Adding analytics, feature flags, or error-tracking SDKs (PostHog, LaunchDarkly, Sentry).
- Adding a third-party image model beyond Gemini (Flux, SDXL, Replicate, Stability, etc.) — explicitly out of scope per CLAUDE.md.
- Creating a mask editor, inpainting workflow, or pixel-selection UI. Gemini conversational editing is the Phase 1 answer.
- Scraping supplier sites. Supplier data is local (`data/suppliers.json`) in Phase 1.
