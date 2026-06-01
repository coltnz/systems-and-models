# bd-8 — Web review UI

- **Status:** open
- **Type:** implementation
- **Depends on:** bd-7 (API), bd-2 (salvage decisions)
- **Blocks:** bd-10

## Problem
The reviewer needs a focused web surface to turn a generated draft pack into a reviewed
pack: per-atom accept/edit/reject/split-lite, source-anchor display, `support_state`
marking, a validation panel, and reviewed-pack save. This is the product workflow, not a
graph hairball.

## Where to look
- bd-2 KEEP/REWRITE/DROP map — reuse only audited pieces (Radix/shadcn `ui/*`, graph
  colors/interactions, Cytoscape ref, domain vocab). Do not import the old DB/import path.
- bd-7 API routes; `spec/learning-pack.schema.json` for field semantics.
- domain-language.md UI Concepts (Inspector, Detail View, Card, Review State, Tutor Mode).

## Proposed change (sketch)
`packages/web` (React/Vite; reuse `app/` audited components):
- Load a draft pack from the server; list atoms with kind, title, summary, `review_state`.
- Per-atom **review actions:** accept (→reviewed), edit (inline title/summary/body/steps),
  reject (→rejected), **split-lite** (clone an atom into two drafts sharing anchors).
- **Source anchor display:** for a selected atom, show its anchors' excerpts + selector and
  `verifiable` flag; let the reviewer set **`support_state`** per (atom,anchor).
- **Validation panel:** call `POST /packs/:id/validate`, render structural + graph errors,
  block reviewed-save while blocking errors exist.
- **Save reviewed pack:** `POST /packs/:id/reviewed`; reflect saved state.

## Definition of done
- A user can: open a draft, accept/edit/reject/split an atom, view anchors, set support_state,
  see validation update, and save a reviewed pack — against the live local server.
- Component/interaction tests for the review actions + validation gating (Vitest + Testing
  Library, mocking the API).
- Build (`vite build`) green; no use of the old sql.js/CDN path or ID-remapping import.

## Gates
- `npm test` (web) green; `npm run build` (web) green; typecheck/lint green.

## Constraints
- Talk to the bd-7 API only; no direct file/db access from the browser.
- Reuse audited spike UI only; no carryover of confirmed-defective code (bd-2).
- Keep the surface focused — accept/edit/reject/split + anchors + validation + save.

## Notes & decisions (mayor)
- _pending; finalize reuse set from bd-2._
