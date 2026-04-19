# AGENTS.md

## Learned User Preferences

- Prefer soft, advisory test checks over hard failures when the underlying rule is uncertain: surface the measured value in the check name and use a generous ceiling rather than failing on best-guess limits.
- Prefer boring, explicit, legible code over clever abstractions; when a dependency isn't ready yet, use a stub + `TODO(...)` marker + injected dependency (e.g., the references file reader) so the function signature stays stable when the real implementation lands.
- For multi-file changes, show a plan with the full file list for approval before writing any code.
- Every new API route must validate its input with Zod.
- Handle every Gemini response with the same `inlineData` extraction pattern the existing test scripts already use — no bespoke parsing per call site.
- When given a plan with pre-created todos, execute straight through: mark each `in_progress` as started, complete all todos without stopping, and never edit the plan file itself.
- Every save, upload, and API action must produce visible feedback (toast or inline message) and never strand the user — nav bar and breadcrumbs stay clickable regardless of form state; no silent successes or failures.

## Learned Workspace Facts

- Phase 1 rendering is unified on a single model: Google Gemini 2.5 Pro Image (`gemini-3-pro-image-preview`) via `@google/genai`. Replicate, Flux dev img2img, and SDXL inpainting are explicitly dropped from Phase 1 and should not be re-introduced.
- Gemini accepts multiple image inputs natively — reference materials (zellige samples, brass patina, flooring swatches, etc.) are attached directly alongside the before-photo, so no separate references pipeline is needed. Conversational editing replaces mask-based inpainting; no element-mask editor is in scope for Phase 1.
- Render prompts for Gemini Pro 3 are natural-language, roughly 2000–4000 chars, written in the voice of a designer briefing a contractor; there is no separate negative-prompt field — constraints go in the positive prompt as "do not..." clauses. This supersedes the earlier Flux/CLIP 280–500-char guidance.
- Render prompts must open by preserving source-photo architecture: room dimensions, ceiling height, window placements, and doorway locations stay exactly as-is and must be called out explicitly in the prompt.
- Claude is used in a two-model operator/reviewer split: Sonnet is the operator (generates the Gemini render prompt by synthesizing the moodboard brief + project theme); Opus is the reviewer (gates the prompt before Gemini and reviews the rendered image after). Opus is the gatekeeper at both boundaries. Per-field Suggest was removed in Session 7.
- `lib/claude/` exposes three prompt builders, all consuming `RenderPromptInput` from `lib/briefs/prompt-input.ts`: `buildRenderPromptRequest` (Sonnet operator) plus `buildPromptReviewRequest` and `buildRenderReviewRequest` (Opus reviewer). Prompt review returns a structured verdict of `ship_it | revise | regenerate` with an issues array and an optional `revised_prompt`.
- Gemini code lives under `/lib/gemini/` (`client.ts`, `prompts.ts`, `edit-prompts.ts`, `references.ts`); the old `/lib/replicate/` tree is removed and the active env var is `GEMINI_API_KEY`, not `REPLICATE_API_TOKEN`.
- Canonical doc filename is `CLAUDE.md` (Anthropic convention), not `claude.md`; on case-insensitive macOS filesystems, `git mv` is required to force the rename.
- Next.js scaffold: Next.js 14 App Router with TypeScript strict, Tailwind, and shadcn/ui (new-york style, Base UI variant). Actual deps in [package.json](package.json): `@supabase/supabase-js`, `@supabase/ssr`, `@google/genai`, `@anthropic-ai/sdk`, `@base-ui/react`, `@vercel/functions`, `zod`, `lucide-react`, `sonner`, `next-themes`, `tailwind-merge`, `tw-animate-css`, `class-variance-authority`, `clsx`, `geist`. No form library (`react-hook-form`, `@hookform/resolvers`) — Session 7 brief/theme forms are plain React with `useReducer` + `useTransition`.
- Phase 1 Supabase schema lives in `supabase/migrations/0001_initial_schema.sql` through `0004_moodboard_flow.sql`. Active tables: `properties`, `property_photos`, `rooms`, `project_themes` (one per property), `room_briefs` (versioned per room), `renders`. Retired but retained (not written to): `room_specs`, `reference_materials`. Supabase clients are `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `lib/supabase/admin.ts` per `@supabase/ssr`.
- Phase 1 red flags — push back if Claude/Cursor proposes any of these: adding cron/queue, Redis/BullMQ, an ORM, auth providers beyond Supabase magic link, analytics/feature flags/error tracking, DB-schema refactors without approval, or prompt strings embedded in UI code.
- `GEMINI_API_KEY` must come from a Google Cloud project with billing enabled and the Generative Language API on; free-tier keys return HTTP 429 with `limit: 0` on image models, and a Google AI Ultra subscription alone does not grant API access. Modern Gemini keys use the `AQ.Ab8RN6...` format (legacy `AIza...` also valid). Secrets live in `.env.local` at the repo root and must never be committed or echoed.
