# bd-6 — Extraction adapter

- **Status:** open
- **Type:** implementation
- **Depends on:** bd-3, bd-5 (anchors), bd-4 (validate output)
- **Blocks:** bd-7

## Problem
We need draft Learning Pack content (atoms, relationships, a derivation run, cost
metadata) generated from a source + its anchors, behind a provider-agnostic interface
with an env-configured OpenAI adapter and a deterministic mock adapter for tests.

## Where to look
- bd-1 report: the proposed `ExtractionAdapter` interface + env var names.
- `spec/learning-pack.schema.json` Atom/Relationship/DerivationRun (`cost{tokens_in,
  tokens_out,usd}`, `authored_by`, `review_state` starts `generated`).
- bd-5 anchors (extraction references existing anchor ids; does not invent anchors).

## Proposed change (sketch)
`packages/extract`:
- `interface ExtractionAdapter { extract(input): Promise<ExtractionResult> }` where input =
  `{ source, anchors, schemaConstraints }` and result = `{ atoms, relationships, derivation }`.
- New atoms/edges start `review_state="generated"`, `authored_by="ai"`, `version=1`,
  reference only existing anchor ids, support_state proposed (human confirms later).
- `OpenAIAdapter`: model id from `OPENAI_MODEL` (**no hardcoded default — throw if unset**),
  `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`; structured output (JSON schema /
  response_format); capture `cost` from the API usage (tokens_in/out + usd via a documented
  price map or 0 if unknown, never fabricated); set `prompt_hash`, `model_name`,
  `model_snapshot`, `created_at`.
- `MockAdapter`: deterministic, no network, returns a fixed plausible draft for a given
  input — used by all tests and the offline demo.
- A factory `getAdapter(env)` selecting mock vs openai.

## Definition of done
- Mock adapter produces a draft that **validates** (bd-4) given bd-5 anchors.
- OpenAIAdapter throws clearly when `OPENAI_MODEL`/`OPENAI_API_KEY` unset; no live call in tests.
- Cost metadata present and well-formed on the derivation run.
- Tests run fully offline using the mock.

## Gates
- `npm test` (extract) green offline; typecheck/lint green; mock output validates via bd-4.

## Constraints
- No network in tests. No hardcoded model default. Don't invent anchors or costs.
- Keep the OpenAI SDK dependency isolated to the OpenAI adapter file.

## Notes & decisions (mayor)
- _pending._
