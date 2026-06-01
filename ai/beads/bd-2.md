# bd-2 — Spike value audit

- **Status:** done
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
Worker report received. **Build FAILS** (22 TS errors) and lint fails (25) — confirmed, not a
baseline. All §4 defects verified at file:line (invalid enums `EditEntityDialog.tsx:32,151,166-169`;
broken imports `Detail.tsx:4,6,7,10` incl. missing `ui/badge.tsx`; KB split 23 vs 157 entries, app
loads the 23; `import-data.ts:91,113,132` discards YAML id; `db/index.ts:100` CDN WASM). Recorded as
D-008 (salvage map) and D-009 (drop list). Salvage set carried into bd-8 (web UI).

**Salvage (KEEP, copy with minor cleanup):** `ui/{button,card,dialog,input,label,textarea}.tsx`,
`lib/{graph-styles,search,permalink,utils}.ts`, `hooks/useKeyboardShortcuts.ts`,
`components/SharePermalinkButton.tsx`. Colors: systems `#3b82f6`, models `#a855f7`, provenance
`#f59e0b`; 4-level semantic zoom. **REWRITE** (pattern only, retarget to Atom/LearningPack v0): pages
(Home/Detail/Graph), create/edit/link/import dialogs — fix `'mental'→mental-model`, drop `'deprecated'`,
add `badge.tsx`. **DROP:** all `lib/db/*` + sql.js (CDN/offline break; probe is JSON-file based),
`import-data.ts`, both sample YAML KBs (content-mine only, not v0), ghost deps
`@tanstack/react-router` + `@tanstack/react-query`.
