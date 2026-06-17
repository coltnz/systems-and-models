# Decision log

Durable product/tech decisions. Format: **Decision** · _Choice_ · Rationale · (bead).
Newest first. Findings that fed these live (gitignored) in `ai/findings/`.

## D-015 · Server serializes mutations per pack id (in-memory mutex) · bd-16 (issue #4)
`withPackLock(packId, fn)` (a per-pack promise-chain) wraps the pack-mutating routes so a read-modify-
write cycle for a pack completes before the next on that same pack starts; different packs stay
concurrent. _Rationale:_ prevents lost updates. Forward-looking — with today's synchronous store
`handle()` is already atomic per call; the lock matters once persistence becomes async. No DB.

## D-014 · The date-time tz-aware rule stays graph-owned, guarded by a test · bd-15 (issue #4)
Kept the lenient structural `date-time` format + the graph-layer `derivation_created_at_not_tz_aware`
check (no runtime-severity change). Added a regression test asserting `created_at` is the only
`date-time` field, so a future `date-time` field forces a conscious graph-check decision. _Rationale:_
fix the fragility (review finding) without moving where the error surfaces.

## D-013 · Pack ids are globally unique; enforced in the validator AND guaranteed at assembly · bd-15 (issue #4)
The validator flags `cross_collection_duplicate_id` (an id shared across sources/anchors/atoms/
relationships/derivations); `assembleExtraction` guarantees uniqueness at the chokepoint (a single
`used` set seeded with the reserved ids) so extraction output can never trip it. _Rationale:_ makes
`DerivationRun.output_ids` unambiguous and preserves the no-stranded-draft property (consistent with
bd-12/bd-13 — the validator check only ever fires on external/hand-edited packs).

## D-012 · Dependent beads run as main-tree, no-commit workers; mayor integrates · process
Agent worktrees branch from `master`, not the alpha branch, so they cannot see merged scaffold
(bd-3 worktree was cut at master and lacked `packages/`/`ai/`). Therefore: the two **audit** beads
ran isolated (read-only, no scaffold needed), but **implementation** beads from bd-4 on are
dispatched as bounded workers in the **main working tree** (on the alpha branch, full scaffold,
can read `ai/beads/*`), instructed to implement + run gates + **not commit**. The mayor reviews the
working-tree diff against the bead, re-runs gates, and commits the integration. Run sequentially to
avoid tree contention. _Rationale:_ preserves the mayor gate + bounded-worker discipline while
letting each worker build on prior merged work; literal git-worktree isolation isn't usable here
because the harness bases worktrees on master. Isolation is kept in spirit (separate agent context,
diff reviewed before it lands).

## D-011 · Build ordering via `tsc -b` project references + `@sam/*` path aliases · bd-3
npm `--workspaces` runs alphabetically, not topologically; node packages build with
`tsc -b tsconfig.build.json` (composite, declaration) so deps build first. TS `paths` + vite
`resolve.alias` map `@sam/*`→sibling `src/index.ts` so a package can typecheck/test without building
deps first. _Rationale:_ removes a foot-gun for downstream beads; the canonical gate still builds first.

## D-010 · Spike `app/` build is broken; not a foundation — confirmed · bd-2
`app/` build fails (22 TS errors) + lint (25). All synthesis §4 defects verified at file:line.
`app/` stays as reference only; the alpha is a clean `@sam/*` rebuild (D-003). _Rationale:_ the
spike was never run end-to-end; extending it costs more than reusing audited pieces.

## D-009 · Spike DROP list for the alpha · bd-2
Drop entirely: `lib/db/*` + **sql.js** (CDN WASM breaks offline; the probe is JSON-file based,
no browser DB), `lib/import-data.ts` (discards YAML ids → broken identity), both
`sample-knowledge-base.yaml` (old schema; content-mine only, not LearningPack v0), and ghost deps
`@tanstack/react-router` + `@tanstack/react-query` (installed, never used). _Rationale:_ all couple
the alpha to spike-era schema/architecture the contract has moved past.

## D-008b · Spike SALVAGE list for the web UI (bd-8) · bd-2
Carry (copy + minor cleanup, retarget to LearningPack v0): `ui/{button,card,dialog,input,label,
textarea}.tsx`; `lib/{graph-styles,search,permalink,utils}.ts`; `hooks/useKeyboardShortcuts.ts`;
`components/SharePermalinkButton.tsx`. Keep graph colors (systems `#3b82f6`, models `#a855f7`,
provenance `#f59e0b`) + 4-level semantic zoom. Add the missing `ui/badge.tsx`. Pages/dialogs are
pattern-only rewrites onto the Atom schema (Model type `mental-model|concept|framework|principle`;
System status `draft|active|archived|proven`). _Rationale:_ these are the audited, defect-free pieces.

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
