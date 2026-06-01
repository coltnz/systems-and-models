# Decision log

Durable product/tech decisions. Format: **Decision** · _Choice_ · Rationale · (bead).
Newest first. Findings that fed these live (gitignored) in `ai/findings/`.

## D-008 · Tutor grounding/refusal is deterministic code, not model discretion · bd-9
The cite-or-refuse decision is made by code over the reviewed graph (reviewed atoms +
reviewed edges + `support_state=supports` anchors). Any LLM phrasing call goes through the
mock/OpenAI adapter, but whether to answer or refuse is not delegated to the model.
_Rationale:_ refusal correctness is a measured probe gate; it must be testable and stable.

## D-007 · `.systems-and-models/` is owned solely by `@sam/server` · bd-1, bd-7
No other package reads/writes the runtime dir directly. ingest/extraction return data;
the server persists it. _Rationale:_ single writer keeps the persistence contract auditable
and keeps the pure packages filesystem-free and unit-testable.

## D-006 · OpenAI adapter: env-config, fail-loud, no hardcoded model default · bd-1, bd-6
`OPENAI_API_KEY` + `OPENAI_MODEL` required (throw if absent); `OPENAI_BASE_URL` optional.
Structured output via `response_format: {type:"json_schema", strict:true}` on the official
`openai` SDK; validate the parsed result with `@sam/validator` before accepting. Cost from
`response.usage` (tokens_in/out) + a documented price map for usd (0, never fabricated, if
unknown). A deterministic zero-cost `MockExtractionAdapter` backs all tests + the offline demo.
_Rationale:_ the probe tracks `usd_per_published_atom`; silent model swaps corrupt the metric.

## D-005 · Validator loads `spec/learning-pack.schema.json` as the single schema source · bd-4
Structural validation = Ajv (2020-12) against the committed schema; graph invariants in code.
Schema is never re-declared in TS. _Rationale:_ one source of truth shared by server, CLI, web.

## D-004 · Test/lint/build gates · bd-1, bd-3
Vitest (root config with per-package projects; node env, jsdom for web), shared
`eslint.config.base.js` (flat) and `tsconfig.base.json`. Root scripts: `build`, `typecheck`,
`lint`, `test` run across workspaces. Pin Node engine `>=22`. _Rationale:_ one green
`npm test`/`npm run build` across packages is the merge gate.

## D-003 · `app/` is a spike kept for reference; the UI is rebuilt as `packages/web` · bd-1
Do not extend `app/`; seed `packages/web` from its working Vite/TS setup and audited pieces
only (bd-2). _Rationale:_ §4 defects make extension costlier than a clean reseed.

## D-002 · Canonical workspace package names · bd-1, bd-3
`@sam/*` scope (Systems And Models): `@sam/types`, `@sam/validator`, `@sam/ingest`,
`@sam/extraction`, `@sam/server`, `@sam/web`, `@sam/e2e`. Layout `packages/*`; `spec/` stays
a repo-root contract dir (not a package). _Rationale:_ clear boundaries, shared types, one
test root. (Supersedes the placeholder `schema`/`extract` names in early bead sketches.)

## D-001 · No Go/asof work blocks the alpha — TS local alpha first · bd-1
Per synthesis §3 call #7 and operating brief: the Go+SQLite+asof question is deferred to the
day-10 go/no-go as a 1-day timebox. Go 1.24 being installed does not change this. _Rationale:_
asof reuse is asserted, not verified; coupling the alpha to it adds risk with no probe benefit.

## D-000 · Beads tracked as committed markdown (no `bd` CLI here) · setup
The `bd` Beads CLI is not installed in this environment; beads live in `ai/beads/*.md` with a
mayor-maintained Notes/Decisions section, `ai/dashboard.md`, and this log. Findings stay
gitignored in `ai/findings/`. _Rationale:_ durable + reviewable across ephemeral containers
without depending on an uninstalled tool or spamming GitHub issues.
