# bd-3 — Alpha scaffold

- **Status:** open
- **Type:** implementation
- **Depends on:** bd-1, bd-2
- **Blocks:** bd-4, bd-5, bd-6, bd-7, bd-8, bd-9, bd-10

## Problem
There is no root npm workspace, no shared TS config, no test runner, no lint/build
wiring, no `.env.example`, and no gitignored local runtime dir. Everything downstream
needs this skeleton.

## Where to look
- bd-1 report (layout + gates + engine) and `ai/decisions.md`.
- Existing `app/` (becomes `packages/web` or stays — per bd-1/bd-2 decision).
- `spec/learning-pack.schema.json` (the shared package will re-export/validate it).

## Proposed change (sketch — finalize from bd-1)
- Root `package.json` with `"workspaces": ["packages/*"]`, `"private": true`, `engines.node`.
- `packages/` skeleton (canonical names, D-002): `@sam/types` (types mirroring the schema),
  `@sam/validator`, `@sam/ingest`, `@sam/extraction`, `@sam/server`, `@sam/web`, `@sam/e2e`.
  Empty but typed package stubs with `package.json` + `src/index.ts` + `tsconfig.json`
  extending a shared base. `spec/` stays a repo-root contract dir (not a package).
- Shared `tsconfig.base.json`; per-package `tsconfig.json` extends it.
- Vitest workspace config; root scripts: `test`, `typecheck`, `lint`, `build`, `dev`.
- Flat ESLint config shared across packages.
- `.env.example` (OPENAI_API_KEY, OPENAI_MODEL — no default, OPENAI_BASE_URL optional).
- `.systems-and-models/` runtime dir created lazily by tooling; already gitignored.

## Definition of done
- `npm install` at root succeeds; `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build` all run green on the empty skeleton (at least one trivial passing test).
- `.env.example` present; no real secrets committed.
- README snippet (or note) explaining the workspace layout.

## Gates
- `npm install && npm run build && npm run lint && npm test && npm run typecheck` green.

## Constraints
- TypeScript/Node + React/Vite only. No backend service, DB, auth, marketplace, sync.
- No hardcoded OpenAI model default anywhere.
- Keep packages dependency-light; pin Node engine from bd-1.

## Notes & decisions (mayor)
- _pending._
