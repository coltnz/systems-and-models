# bd-2 — Spike value audit

- **Status:** dispatched
- **Type:** audit (no implementation)
- **Depends on:** —
- **Blocks:** bd-3, bd-8 (salvage decisions)
- **Worker:** general-purpose (background)

## Problem
The existing `app/` is a spike, not a foundation. We need an evidence-based keep/rewrite/
drop map before deciding what (if anything) to carry into the alpha. Known current value:
domain vocabulary, graph colors/interactions, shadcn/Radix direction, Cytoscape reference,
sample data. Known risks: build fails, sql.js CDN/offline, YAML import remaps IDs, detail
route/import drift, old system/model/provenance DB model ≠ Learning Pack v0.

## Where to look
- `docs/11-best-of-breed-synthesis.md` §4 (verified defects, with file:line claims) + §2/§3.
- `app/src/**` — pages (Home, Detail, Graph), components (dialogs, `ui/*`), `lib/db/*`,
  `lib/graph-styles.ts`, `lib/import-data.ts`, `lib/search.ts`, `lib/permalink.ts`.
- `app/public/data/sample-knowledge-base.yaml` vs `data/sample-knowledge-base.yaml`.

## Definition of done
Report: (A) build/lint result (confirm/refute "build fails") with verbatim key errors,
(B) defect verification table at file:line for each §4 claim, (C) surface inventory,
(D) KEEP/REWRITE/DROP map, (E) salvage list + "Decisions to record".

## Gates
- `npm install` + `npm run build` + `npm run lint` actually executed in `app/` (node_modules
  only; not committed).

## Constraints
- No edits to tracked files, no commits. Running the build is allowed.

## Notes & decisions (mayor)
- _pending worker report._
