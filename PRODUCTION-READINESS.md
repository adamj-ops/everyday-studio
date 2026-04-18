# Production-Readiness Audit — Phase 1

**Generated:** 2026-04-18
**Audited commit:** `947f958` (Session 5 polish + Session 6 handoff)
**Phase 1 ship criteria:** see [CLAUDE.md](CLAUDE.md) § "Phase 1 success criteria"

## How to use this document

Three parallel audits (server/API, Supabase/RLS/storage, frontend/runtime) produced the findings below. They are deduped, spot-checked against the real code, and triaged into four buckets. **Bucket 1 blocks the Session 6 ship. Bucket 2 is Session 6 work items.** Bucket 3 is post-ship backlog. Bucket 4 is noise already vetted — documented so future audits don't re-raise it.

Fixes are scoped to one-liner code changes or 5-minute dashboard config. Anything larger is demoted.

## Triage summary

| Bucket | Count | Severity mix |
|---|---|---|
| 1. Ship blockers | 6 | 3 CRITICAL, 3 HIGH |
| 2. Fold into Session 6 | 3 | n/a |
| 3. Post-ship backlog | 8 | 5 MEDIUM, 3 LOW |
| 4. Not applicable | 4 | n/a |

**Ship blockers at a glance:**

1. [CRITICAL] Timeout + try/catch on the Anthropic call in the Suggest route
2. [CRITICAL] Stop leaking Supabase error messages to clients (sweep `app/api/**`)
3. [CRITICAL] Replace the silent `.catch(() => ({}))` on `signPhotoUrls`
4. [HIGH] Photo upload orphan — rollback Storage object on `property_photos` insert failure
5. [HIGH] Strip EXIF on photo upload (GPS coordinates to the house)
6. [HIGH] Set monthly budget alerts on Anthropic ($100) and Google AI ($50) dashboards

---

## Bucket 1: Ship blockers

Fix before Session 6 merges to `main`.

### [CRITICAL] Timeout + try/catch on the Anthropic call in the Suggest route

**File:** [app/api/rooms/[id]/spec/suggest/route.ts:87](app/api/rooms/[id]/spec/suggest/route.ts:87)
**Problem:** `anthropicClient.messages.create` has no try/catch and no `maxDuration`; a slow Sonnet response past the Vercel default timeout terminates mid-call with a 504 and no recovery path.
**Fix:** Add `export const maxDuration = 30;` at module scope, wrap the `messages.create` in try/catch, return `{ error: "claude_call_failed" }` 502 on throw.

### [CRITICAL] Stop leaking Supabase error messages to clients

**File:** [app/api/rooms/[id]/spec/suggest/route.ts:49](app/api/rooms/[id]/spec/suggest/route.ts:49) (and every other route under `app/api/**` with the same pattern)
**Problem:** Routes return `{ error: err.message }`, surfacing internal database text (RLS violations, constraint names, connection strings) to the UI.
**Fix:** Sweep `app/api/**`; replace every `{ error: err.message }` with a generic code (`"database_error"`, `"claude_call_failed"`, etc.) and `console.error` the real error server-side.

### [CRITICAL] Replace the silent `.catch(() => ({}))` on `signPhotoUrls`

**File:** [app/properties/[id]/page.tsx:51](app/properties/[id]/page.tsx:51)
**Problem:** Signing failure swallows silently into an empty map; photos render as "Unavailable" placeholders with no diagnostic and no recovery affordance.
**Fix:** Log the error server-side, return the empty map, render a one-line "Some photos couldn't be loaded — refresh to retry" banner in the UI.

### [HIGH] Photo upload orphan — rollback on insert failure

**File:** [app/api/properties/[id]/photos/route.ts:68-101](app/api/properties/[id]/photos/route.ts:68)
**Problem:** Storage object is uploaded first; if the subsequent `property_photos` insert fails, the object persists orphaned and the DB has no record of it.
**Fix:** Supabase JS has no transactions; add a compensating `storage.remove([path])` in the catch path so Storage never outlives a failed DB write.

### [HIGH] Strip EXIF on photo upload

**File:** [app/api/properties/[id]/photos/route.ts](app/api/properties/[id]/photos/route.ts) (server side) or [components/photo-upload-sheet.tsx](components/photo-upload-sheet.tsx) (client side, before signed-URL PUT)
**Problem:** Property photos carry GPS coordinates pointing at the physical address; retrofitting after external sharing features ship is expensive.
**Fix:** Add `exifr` (lighter) or `sharp` (pick `sharp` if thumbnails are on the near-term roadmap), strip metadata before the bytes land in Storage. Pick server- or client-side based on whichever fits the existing upload shape.

### [HIGH] Set monthly budget alerts on Anthropic ($100) and Google AI ($50) dashboards

**File:** n/a — dashboard config
**Problem:** A runaway client-side loop on the Suggest or Generate endpoint has no alarm; first notice is the monthly invoice.
**Fix:** Anthropic console → Settings → Billing → Spend alerts at $100/mo. Google Cloud console → Billing → Budgets & alerts on the Gemini API project at $50/mo. 5 minutes total.

---

## Bucket 2: Fold into Session 6

Session 6 is already writing migration 0003 and the render routes. Piggyback these while the files are open.

### Migration idempotency

**File:** `supabase/migrations/0003_*.sql` (to be created in Session 6)
**Problem:** `CREATE POLICY` and `ADD CONSTRAINT` statements in migrations 0001/0002 are not idempotent; re-running a failed migration requires manual recovery. Supabase branches will trip this the first time they're used.
**Fix:** Wrap all `CREATE POLICY` in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`. Apply to migration 0003. Retrofit 0001/0002 only if touching them anyway.

### `maxDuration` on the new render routes

**File:** `app/api/render/generate/route.ts`, `app/api/render/edit/route.ts` (to be created)
**Problem:** The Sonnet → Opus → Gemini → Opus chain is the one place in Phase 1 that realistically hits Vercel's default function timeout.
**Fix:** `export const maxDuration = 60;` at module scope. Hobby plan caps at 10s; Pro caps at 60s. Confirm the Vercel plan before shipping.

### Request body cap awareness

**File:** `app/api/render/generate/route.ts`, `app/api/render/edit/route.ts` (to be created)
**Problem:** Vercel serverless caps request body at 4.5 MB. Gemini returns base64-encoded images that the server re-uploads to Storage; a chained edit flow could brush the ceiling silently.
**Fix:** Log payload sizes during the Vincent Ave end-to-end test. If base64 image + metadata approaches 3 MB, switch to signed-URL PUT from the client for render uploads instead of round-tripping through the API route.

---

## Bucket 3: Post-ship backlog

Real but not blocking. Triage after the first week of production use.

### [MEDIUM] Root `app/error.tsx` and `app/global-error.tsx`

**File:** `app/error.tsx` (missing), `app/global-error.tsx` (missing)
**Problem:** No React error boundaries — an uncaught render error shows Next.js's default error UI rather than a branded recovery screen.
**Fix:** Add as the first post-launch polish pass with real error data informing the design, not speculative boundaries. Next.js App Router defaults are acceptable for single-user internal use.

### [MEDIUM] Storage path validation uses `startsWith` — tighten to exact segment count

**File:** [app/api/properties/[id]/photos/route.ts:57-65](app/api/properties/[id]/photos/route.ts:57)
**Problem:** `name.startsWith(\`${propertyId}/\`)` accepts `${propertyId}/../other/foo.jpg`; low real-world risk on a single-user tool.
**Fix:** `path.split('/').length === 2 && !path.includes('..')` — reject anything else.

### [MEDIUM] No MIME/extension cross-validation on uploads

**File:** [app/api/properties/[id]/photos/sign/route.ts](app/api/properties/[id]/photos/sign/route.ts)
**Problem:** MIME allow-list filters correctly, but a `image/png` MIME with a `.jpg` filename slips through; metadata ends up mismatched.
**Fix:** Map MIME → expected extension; reject on mismatch.

### [MEDIUM] Signed URL TTL hardcoded

**File:** [lib/supabase/signed-urls.ts](lib/supabase/signed-urls.ts)
**Problem:** `DEFAULT_TTL_SECONDS = 3600` is hardcoded; tuning requires a code change.
**Fix:** Move to env var when a different value is needed. Not before.

### [MEDIUM] `room_label` on photo upload isn't cross-validated against the rooms table

**File:** [app/api/properties/[id]/photos/route.ts:81](app/api/properties/[id]/photos/route.ts:81)
**Problem:** Photo can land with a `room_label` that matches no row in `rooms`; the label is free-text from the client.
**Fix:** Verify `(property_id, label)` exists in `rooms` before the `property_photos` insert.

### [LOW] Route-level rate limiting

**File:** repo-wide
**Problem:** No per-route rate limits on Suggest or render routes.
**Fix:** Budget alarms (Bucket 1 #6) cover the cost-runaway case on a single-user tool. Revisit when multi-user arrives.

### [LOW] Loading skeletons missing

**File:** [app/dashboard/page.tsx](app/dashboard/page.tsx), [app/properties/[id]/rooms/[roomId]/spec/page.tsx](app/properties/[id]/rooms/[roomId]/spec/page.tsx)
**Problem:** Blank screen during initial server-component fetch.
**Fix:** Add Suspense boundaries with skeleton components.

### [LOW] Dashboard raw `error.message` display

**File:** [app/dashboard/page.tsx](app/dashboard/page.tsx)
**Problem:** Same leak pattern as the Suggest route, narrower surface.
**Fix:** Fold into the Bucket 1 #2 sweep when convenient.

---

## Bucket 4: Not applicable

Findings raised during audit and dismissed. Documented so future audits don't re-raise them.

| Finding | Why dismissed |
|---|---|
| Next.js `images.remotePatterns` config missing | Zero `next/image` usage in the repo (verified via `rg -l "from ['\"]next/image['\"]"`). Photos render as plain `<img>` with signed URLs. |
| Environment variable exposure in client bundles | No server-only var is currently leaked to a `'use client'` file. ESLint rule worth adding later; nothing is exposed now. |
| `renders.spec_snapshot_json` column missing | Session 6 adds `renders.room_spec_id` (Option A from the SESSIONS.md handoff). Not a gap — it's the next task. |
| `room_specs` RLS / `locked_bool` immutability | Session 6 implements immutability via versioning (always INSERT, never UPDATE) and drops `locked_bool` from the schema. Versioning produces immutability; no column-level RLS enforcement needed. |
