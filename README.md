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

## Run the alpha

The alpha proves one loop end-to-end, **fully offline** on the mock adapter:

> a user supplies transcript/Markdown → **generates** a draft Learning Pack →
> **validates** it → **reviews/edits** it → **saves** a reviewed pack → asks a
> grounded **tutor** question that cites reviewed anchors **or refuses**.

### 1. Install + prove it offline

```bash
npm install
npm test        # all packages, fully offline (mock adapter, no API key)
```

`npm test` includes the scripted end-to-end proof
(`packages/e2e/src/walkthrough.test.ts`): it drives the real server core over a
temp data dir with a fixed clock, asserting that the **draft validates**, the
**reviewed snapshot saves**, the tutor **cites in-scope** and **refuses
out-of-scope**. The committed example artifacts
(`packages/e2e/examples/draft-pack.json`, `reviewed-pack.json`) are regenerated
deterministically by `npm run demo` and validate against
`spec/learning-pack.schema.json`.

### 2. Run it by hand (server + web UI)

Two terminals:

```bash
# Terminal A — local API on the FIXED port 8787 (mock adapter, no key needed).
# Writes the file-backed store to ./.systems-and-models/ (gitignored).
npm run serve         # -> "listening on http://127.0.0.1:8787"

# Terminal B — the web review UI (Vite dev server on :5173).
npm run dev           # open the printed http://localhost:5173 URL
```

The web client's `VITE_API_BASE` defaults to `http://127.0.0.1:8787`, matching
`npm run serve`'s fixed port. In the browser, walk the alpha goal sentence:

1. **Supply a source** — paste the demo transcript from
   `packages/e2e/fixtures/circuit-breaker.md` (original, **CC-BY-4.0**) into the
   source box. → _supplies transcript/Markdown_
2. **Generate draft** — generates a draft Learning Pack via the mock adapter and
   shows it validating. → _generates a draft pack → validates_
3. **Review** — per atom: accept / edit / reject / split, and set `support_state`
   on each (atom, anchor). Accept the **circuit-breaker model atom** with its
   anchor set to `supports`. → _reviews/edits_
4. **Save reviewed pack** — persists a reviewed snapshot once validation is
   clean. → _saves a reviewed pack_
5. **Ask the tutor** — an **in-scope** question (e.g. _"What is the circuit
   breaker pattern?"_) returns an answer citing the reviewed anchor; an
   **out-of-scope** question (e.g. about photosynthesis) **refuses**. →
   _grounded tutor cites or refuses_

### 3. Scripted proof (no browser)

```bash
npm run demo          # builds @sam/e2e, runs the offline walkthrough,
                      # prints the loop summary, rewrites examples/*.json
```

This is the same flow the `npm test` gate asserts; it never touches the network.

### OpenAI (optional)

The demo + all tests run on the **mock** adapter by default. To use the OpenAI
extraction adapter for `npm run serve`:

```bash
cp .env.example .env
# set OPENAI_API_KEY, OPENAI_MODEL (no default — D-006), EXTRACTION_ADAPTER=openai
npm run serve
```

The mock path is unchanged; tests stay offline regardless.

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
