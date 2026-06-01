# bd-7 — Local alpha server

- **Status:** open
- **Type:** implementation
- **Depends on:** bd-4, bd-5, bd-6
- **Blocks:** bd-8, bd-9, bd-10

## Problem
The web UI and tutor need a thin local, file-backed API tying ingest, extraction,
validation, review edits, and saved packs together. No hosted backend, no DB.

## Where to look
- bd-4 `validatePack`, bd-5 `ingestSource`, bd-6 `getAdapter`/`extract`.
- gitignored `.systems-and-models/` runtime dir = the file store (sources, packs, runs).

## Proposed change (sketch)
`packages/server` — a small Node HTTP server (framework per bd-1; keep deps light) with
file-backed persistence under `.systems-and-models/`:
- `POST /sources` — accept transcript/Markdown ⇒ ingest (bd-5) ⇒ persist SourceAsset+anchors.
- `GET /sources`, `GET /sources/:id`.
- `POST /packs/draft` — from a source id, run extraction (bd-6, mock unless env configured)
  ⇒ assemble a draft pack (source+anchors+atoms+rels+derivations) ⇒ persist ⇒ return id.
- `GET /packs`, `GET /packs/:id`.
- `POST /packs/:id/validate` — run bd-4, return `ValidationResult`.
- `PATCH /packs/:id` (or `/atoms`,`/relationships`) — apply review edits
  (accept/edit/reject/split-lite, set `support_state`, bump `review_state`/`version`,
  append an `edit` DerivationRun). Re-validate on save.
- `POST /packs/:id/reviewed` — save a reviewed pack snapshot (separate file/state).
- `POST /tutor/query` — delegated to bd-9 logic (reviewed-only).

## Definition of done
- Server boots, creates `.systems-and-models/` on demand, persists across restarts.
- Each route covered by an integration test using the mock adapter and a temp data dir.
- All writes re-validate (bd-4) and reject invalid mutations with clear errors.
- No secrets in logs; OpenAI only used when env configured, else mock.

## Gates
- `npm test` (server) green offline (temp dir, mock adapter); typecheck/lint green.

## Constraints
- Local only; bind localhost. No auth, no DB, no sync. File store is the source of truth.
- Tutor route must not traverse unreviewed atoms/edges (enforced in bd-9).

## Notes & decisions (mayor)
- _pending._
