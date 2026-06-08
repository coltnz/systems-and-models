# bd-1 — Tech/setup audit

- **Status:** done
- **Type:** audit (no implementation)
- **Depends on:** —
- **Blocks:** bd-3
- **Worker:** general-purpose (background)

## Problem
Before scaffolding we must confirm the alpha's setup shape so the scaffold bead is
unambiguous: npm workspace layout, Node version, package boundaries, test/lint/build
gates, the OpenAI adapter interface, and whether any Go/`asof` work should block the
TS local alpha.

## Where to look
- `docs/11-best-of-breed-synthesis.md` §3 call #7 (stack: "none yet, JSON + validator + CLI"),
  §3 call #6 (contract → CLI → editor), the asof timebox.
- `docs/12-operating-brief-v0.md` (asof audit is NOT a probe blocker).
- `spec/learning-pack.schema.json` (the contract the tooling serves).
- `app/package.json`, `app/tsconfig*.json` (current single-package shape).

## Definition of done
A report covering: (1) current state, (2) recommended npm workspaces layout + package
list, (3) package boundaries + where pack JSON and the gitignored `.systems-and-models/`
runtime live, (4) root test/lint/build/typecheck gate scripts + Vitest/ESLint/tsconfig
approach + Node engine to pin, (5) the OpenAI extraction adapter TS interface (env-config,
no hardcoded model default, mock for tests, cost capture), (6) explicit Go/asof
block decision (default: no block). Ends with a "Decisions to record" list.

## Gates
- None (research). Output must be concrete enough to write bd-3 against.

## Constraints
- No file changes, no commits. Report only.
- Default answer on Go/asof: **no block; TS local alpha first** unless evidence says otherwise.

## Notes & decisions (mayor)
Worker report received; distilled into `ai/decisions.md` D-001…D-007. Highlights:
- No root workspace today; Node v22.22.2 / npm 10.9.7; `app/` is ESM, composite tsconfig,
  flat ESLint, no test script, sql.js WASM from CDN (confirmed defect).
- Canonical layout: `packages/{types,validator,ingest,extraction,server,web,e2e}` under a
  root `workspaces:["packages/*"]`; `spec/` stays the schema contract dir (D-002).
- Gates: root Vitest (projects), shared `tsconfig.base.json` + `eslint.config.base.js`,
  pin `engines.node >=22` (D-004).
- OpenAI adapter: `OPENAI_API_KEY`+`OPENAI_MODEL` required (no default), optional
  `OPENAI_BASE_URL`, `response_format:json_schema strict`, cost from `usage`, mock for tests (D-006).
- **Go/asof: no block; TS local alpha first** (D-001).
- `app/` kept for reference; UI rebuilt as `packages/web` reusing audited pieces only (D-003).
