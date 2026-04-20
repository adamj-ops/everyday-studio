# Changelog

All notable changes to this project are documented here. Commit messages may reference these entries (e.g. `Session 8`).

## [Unreleased]

### Session 8 — Foundation (2026-04-20)

- **Hygiene:** API routes return stable `internal_error` + `code` instead of raw Supabase messages; server-side logging preserved. Property page logs `signPhotoUrls` failures and shows a retry banner. Photo finalize strips EXIF via `sharp`, rolls back Storage objects on failed DB insert.
- **Studio:** Download rendered PNG with filename `{address_slug}_{room_type}_{ordinal}.png`; `GET /api/renders/[id]` includes `ordinal` for polling clients.
- **Prompts:** Stronger singular-fixture and room-layout preservation in Sonnet operator prompt; brief non-negotiables copy asks designers to list existing major fixtures.
- **Tooling:** `npm run lint`, `npm run typecheck`; ESLint via `next/core-web-vitals`.
- **Docs:** `docs/design-spec.md` for Sessions 9–11 design elevation.
