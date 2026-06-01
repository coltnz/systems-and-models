# bd-4 — Pack validator

- **Status:** done (merged e8a5bc3)
- **Type:** implementation
- **Depends on:** bd-3
- **Blocks:** bd-7, bd-9, bd-10

## Problem
JSON Schema alone cannot enforce the pack's semantic invariants. We need a validator that
runs structural (JSON Schema) **and** graph-level checks so the probe can treat a pack as
"valid" with confidence.

## Where to look
- `spec/learning-pack.schema.json` (structural contract; `$defs`, publish/anchor rules).
- `docs/11-best-of-breed-synthesis.md` §5 (publish invariant, reviewed-only traversal,
  relationship anchor/support dependency, `verifiable` is computed not trust).
- `spec/examples/spaced-repetition-talk.learning-pack.json` (must validate clean).

## Proposed change (sketch)
`packages/validator` exporting `validatePack(pack): ValidationResult`:
1. **Structural:** Ajv (2020-12) against the schema; collect errors with JSON paths.
2. **Graph-level:**
   - referential integrity: every `anchor_id`, `source_asset_id`, `from/to_atom_id`,
     `derivation_id`, relationship `anchor_ids` resolves to an existing record; ids unique.
   - **publish invariant:** a `published` atom needs ≥1 anchor with `support_state="supports"`
     and `review_state ∈ {reviewed, published}`.
   - **reviewed-only traversal:** flag any non-`reviewed` relationship as non-traversable;
     expose a `traversableEdges` helper for the tutor.
   - **relationship anchor/support dependency:** if `anchor_ids` present, `support_state`
     required (mirror schema `dependentRequired`) and each anchor must resolve.
   - **date-time behavior:** validate `DerivationRun.created_at` is RFC3339/ISO-8601;
     define and test tolerance (e.g. require `Z`/offset, reject naive/ambiguous).
- Result shape: `{ ok, errors: [{code, path, message, severity}] }`. Distinguish
  structural vs graph errors; stable error codes.

## Definition of done
- Example pack validates with zero errors.
- Unit tests cover each invariant with a passing and a deliberately-broken fixture
  (dangling ref, published-without-supports, traversal of unreviewed edge, anchor_ids
  without support_state, bad/naive datetime).
- `validatePack` is pure (no fs/network); usable by server and CLI.

## Gates
- `npm test` (validator) green; `npm run typecheck`/`lint` green; example pack passes.

## Constraints
- No network. Deterministic. Don't redefine the schema in code — load `spec/…json`
  (or the schema re-export from `packages/schema`) as the single source of truth.

## Notes & decisions (mayor)
Reviewed diff (validator pkg + lockfile + 1 justified e2e one-liner) and re-ran all 5 gates green
(31 tests; validator 20). Example pack validates clean. Implementation matches the bead:
- Ajv2020 + ajv-formats, single schema source via up-walk path resolver (works from src + dist).
- All graph invariants present with a stable `ValidationCode` taxonomy + `severity`.
- `traversableEdges`/`isTraversable` exported for bd-9.
- **Decision (approved):** the tz-aware datetime rule lives in the graph layer
  (`derivation_created_at_not_tz_aware`); the structural `date-time` format is overridden lenient so
  it doesn't shadow the graph code. Single owner of the datetime contract. Good call.
- **Note for bd-7/bd-9:** `relationship_anchor_without_support_state` is defense-in-depth — the
  schema's `dependentRequired` catches it at the structural layer first (short-circuits), so that case
  surfaces as `severity:"structural"`. Callers should treat missing support_state as structural.
- ajv/ajv-formats CJS interop handled (named `Ajv2020` import + `createRequire` for the plugin);
  downstream packages get it via the public API.
