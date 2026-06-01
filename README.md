# Systems & Models

A local-first probe that turns a single source (talk, paper, PDF) into a
**reviewed learning graph** — anchored atoms (systems / models / claims) and
first-class, reviewable relationships — so the value of model-assisted authoring
can actually be measured. See `spec/learning-pack.schema.json` for the v0
contract and `ai/decisions.md` for the durable decisions behind this layout.

## Prerequisites

- **Node ≥ 22** (`.nvmrc` pins `22`; `engines.node` enforces it).
- npm (ships with Node).

## Quickstart

```bash
npm install
```

### Gate commands

These five must all pass; together they are the merge gate (D-004):

```bash
npm install && npm run build && npm run lint && npm test && npm run typecheck
```

| Script             | What it does                                                     |
| ------------------ | --------------------------------------------------------------- |
| `npm run build`    | `tsc` build of every package (`--workspaces --if-present`).      |
| `npm run typecheck`| `tsc --noEmit` per package (`--workspaces --if-present`).        |
| `npm run lint`     | ESLint (flat config) over `packages/*`.                          |
| `npm test`         | Root Vitest, one project per package (node env; jsdom for web).  |
| `npm run dev`      | Starts the `@sam/web` Vite dev server.                           |

## Workspace layout

npm workspaces under `packages/*` (`@sam/*` scope, D-002). Each package is a
typed stub today; its owning bead fills it in.

| Package           | Role                                                              | Bead   |
| ----------------- | ---------------------------------------------------------------- | ------ |
| `@sam/types`      | Shared TypeScript types mirroring the LearningPack v0 schema.     | bd-3   |
| `@sam/validator`  | Structural + graph validation of a pack (Ajv against the schema).| bd-4   |
| `@sam/ingest`     | Source → stored asset + verifiable anchors (pure data).          | bd-5   |
| `@sam/extraction` | Pluggable extraction adapters (mock + OpenAI); `getAdapter(env)`.| bd-6   |
| `@sam/server`     | Local HTTP API; sole owner of the `.systems-and-models/` dir.    | bd-7   |
| `@sam/web`        | React + Vite review UI (rebuilt fresh; `app/` is a spike, D-003).| bd-8   |
| `@sam/e2e`        | End-to-end flow tests across all packages.                       | bd-10  |

Dependency direction: `types` ← everything; `validator`/`ingest`/`extraction` ←
`server`; all ← `e2e`. `spec/` stays a repo-root contract dir (not a package),
and `app/` is the reference spike — kept as-is, not extended.

## Runtime data

`@sam/server` owns a gitignored `.systems-and-models/` directory for file-backed
packs, sources, and runs (D-007). It is created lazily by the tooling and never
committed; no other package touches it.

## Offline by default

The alpha runs **fully offline** on the deterministic, zero-cost
`MockExtractionAdapter`. There is **no hardcoded OpenAI model default**: the
OpenAI adapter (bd-6) requires `OPENAI_API_KEY` + `OPENAI_MODEL` and fails loud
if they are absent. Copy `.env.example` to `.env` only when you wire that up.
