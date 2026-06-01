# bd-4 — Pack validator

- **Status:** open
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
- _pending._
