# AGENTS.md

## Learned User Preferences

- Prefer soft, advisory test checks over hard failures when the underlying rule is uncertain: surface the measured value in the check name and use a generous ceiling rather than failing on best-guess limits.
- When choosing Gemini image models, default `test:nano` (first-render fidelity) to the premium tier (`gemini-3-pro-image-preview`) and default `edit:nano` (iterative tweaks) to the cheap tier (`gemini-2.5-flash-image`) to keep iteration loops affordable.

## Learned Workspace Facts

- Image rendering experiments use Google's Gemini API via the `@google/genai` SDK; relevant models are `gemini-3-pro-image-preview` (premium quality), `gemini-3.1-flash-image-preview` (newer flash), and `gemini-2.5-flash-image` (aka "Nano Banana", cheap/fast). `imagen-4.0-*` is text-to-image only and does not accept a source photo, so it is unsuitable for the renovation img2img pipeline.
- Nano-banana scripts (`scripts/test-nano-banana.ts`, `scripts/edit-nano-banana.ts`) read the model from a `MODEL` env var with a per-script default, and write outputs to filenames that include a sanitized model slug so A/B runs don't overwrite each other.
- npm scripts for image testing: `npm run test:nano` → `tsx scripts/test-nano-banana.ts`; `npm run edit:nano -- "<instruction>"` → `tsx scripts/edit-nano-banana.ts`.
- `GEMINI_API_KEY` must come from a Google Cloud project with billing enabled and the Generative Language API turned on; free-tier keys return HTTP 429 with `limit: 0` on `gemini-2.5-flash-image`. The Google AI Ultra consumer subscription does not by itself grant API access — API calls still bill against the linked Cloud project (Ultra mainly raises rate-limit tiers).
- Gemini API keys in this workspace use the modern `AQ.Ab8RN6...` format, not the legacy `AIza...` prefix; both are valid.
- Render prompts target Flux-class CLIP text encoders (77-token window, roughly 300–400 chars of natural prose). Aim for 280–500 chars, front-load the highest-priority tokens (aesthetic → cabinetry → counters → backsplash → flooring → hardware → lighting → preserved elements → quality tokens), and use dense noun-adjective clusters instead of full descriptive clauses.
- Secrets live in `.env.local` at the repo root (Anthropic, Replicate, RentCast, Gemini, etc.); never commit it and never echo key values in responses.
