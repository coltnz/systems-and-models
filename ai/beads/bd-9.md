# bd-9 — Tutor proof surface

- **Status:** done (merged 2b6b14f)
- **Type:** implementation
- **Depends on:** bd-4 (traversal helper), bd-7 (server)
- **Blocks:** bd-10

## Problem
The tutor is a *grounding proof surface*, not the product: it must answer only from
reviewed atoms/relationships and cite reviewed anchors, or **refuse**. A confident answer
with no reviewed grounding is the failure mode we are specifically testing.

## Where to look
- `docs/11-best-of-breed-synthesis.md` §3 call #8, §5 (reviewed-only traversal),
  §6 (refusal correctness ≈0.9 on a fixed ≥20-question out-of-scope set).
- bd-4 `traversableEdges` / reviewed-only helpers; bd-7 `POST /tutor/query`.

## Proposed change (sketch)
`packages/tutor` (or in server): `answer(pack, question)` that:
- Builds a retrieval context from **reviewed/published atoms only** and **reviewed edges only**
  (uses bd-4 helpers; never touches generated/rejected content).
- Returns either `{ kind: "answer", text, citations: [{atom_id, anchor_id, excerpt}] }`
  where every citation is a reviewed anchor with `support_state="supports"`, **or**
  `{ kind: "refusal", reason }` when the reviewed graph doesn't ground the question.
- LLM call (if any) goes through the bd-6 adapter (mock in tests); the **grounding/refusal
  decision is deterministic code**, not left to the model's discretion.

## Definition of done
- In-scope question over the reviewed example pack ⇒ answer citing the correct reviewed anchor.
- Out-of-scope / unreviewed-only question ⇒ refusal (no fabricated citation).
- **Refusal test suite:** a fixed set (≥10 here; ≥20 for the real probe) of out-of-scope
  questions, asserting refusal; plus tests that answers never cite non-reviewed anchors.

## Gates
- `npm test` (tutor) green offline with mock; typecheck/lint green; refusal suite passes.

## Constraints
- Reviewed-only. Cite-or-refuse. No traversal of generated/edited/rejected atoms or
  non-reviewed edges. No network in tests.

## Notes & decisions (mayor)
Reviewed (server pkg only, no new deps) and re-ran 5 gates green (92 tests; 24 tutor). Deterministic,
offline, reviewed-only cite-or-refuse — matches D-008.
- Eligible = reviewed/published atoms with a `supports`-resolvable anchor; structurally cannot cite
  generated/edited/rejected atoms or non-supports/dangling anchors. Token-overlap retrieval,
  `MIN_OVERLAP=1` (documented/exported), answer text from cited atom (summary→body→title).
- Route `POST /tutor/query {pack_id,question}` loads the reviewed snapshot; refuses if none; 400 on
  missing fields.
- **For bd-10:** the mock sets the claim atom's anchor to `partially`, so the demo must `set_support`→
  `supports` on the atom it wants cited, and pick an in-scope question overlapping the model atom
  (anchor[0]); use an unrelated question for the refusal leg.
