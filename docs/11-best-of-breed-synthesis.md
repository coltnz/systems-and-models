# Best-of-Breed Synthesis (v2)

Date: 2026-05-26

Reconciles the independent 2026 revisit passes (`09-revisit-2026.md` + `10-wedge-spec…`
[Claude]; `09-2026-revisit-ai-learning-strategy.md` [Codex]) and the three reviews of v1
of this doc. It is a decision record, ordered by what matters: unearned premises first,
agreements second, calls third, the executable probe last.

**Honest framing (conceded to review 3):** this is **not a pivot.** The original vision and
both revisit passes already shared systems/models/provenance, graph-as-one-mode,
local-first, grounded tutoring, and registry ambitions. What changed is *discipline*:
provenance moved to the center, AI output became a reviewable proposal, phasing flipped to
contract-first, and an evaluation gate appeared. The genuinely new value is the **validation
discipline (§1 + the gate in §6)**, not a new destination. Treat it as a sharpening +
build-reset.

---

## 1. What neither pass has earned (read this first)

Both source docs are supply-side reasoning by language models about what would be good to
build. None of the following is evidence yet. Ordered by likely fatality.

1. **Curation burden / moat (was §4.4).** NotebookLM and ChatGPT Study Mode already do
   source-grounded chat, citations, study guides, and step-by-step tutoring. So the tutor
   is **not** the moat. The only differentiator is an *editable, reviewed, exportable
   artifact with derivation lineage and evals*. That wins **only if** users will do
   curation work the lab tools have trained them not to do. If they won't, the primary user
   is **creators, not learners** — a product-identity-level unknown. This may be more fatal
   than extraction quality, and the supply probe alone does not touch it.
2. **Extraction quality.** The whole thesis rests on AI producing *good* system/model/claim
   decompositions, not plausible slop. If the human edit rate is high, the tool is worse
   than reading the source. Most likely fatal-and-cheap-to-test of the *technical* risks.
3. **No demand validation.** Zero users. The first vertical must double as a demand probe
   (§6), and it must be **behavioral, not stated-preference** — interviews about a
   nonexistent tool are themselves weak evidence.
4. **Copyright for paid packs.** "Minimal excerpt + reference" is legally untested for
   redistribution. Sidestepping it with owned/CC sources is fine for v1, but it means the
   probe learns **nothing** about the redistribution case the marketplace thesis depends on.
   Not a footnote: it can cap the product at personal-use.
5. **asof reuse is asserted, not verified.** The Go-core recommendation (§3 call) hinges on
   it. Betting the core on asof code-sharing couples two pre-PMF projects — a risk vector,
   not just upside. Audit before committing (timeboxed — see §6).

## 2. Settled (independent agreement — necessary but weak evidence)

Two models agreeing is consensus, not proof; weight these only because they were reached
separately. Collapsed to the real decisions (review 3 was right that v1 inflated facets
into 10 "agreements"):

- **Not a PKM app** — the product is a *source → reviewed learning graph* studio, and the
  unit of trust is the link {atom ↔ source span ↔ extraction run ↔ review state}, not a
  node. (This subsumes "anchors-are-center / anchors-before-summaries / no-publish-without-
  anchor / AI-output-is-a-proposal" — facets of one decision.)
- **Kill `credibility_score`** → computed signals.
- **Packages before marketplace; graph is a mode, not the workspace.**
- **`asof` is the lineage/inspector/fork-diff substrate**, not storage, not an immediate merge.
- **The current app is a spike — reset, don't extend** (defects verified in §4).

## 3. The calls

| # | Topic | Call + why |
|---|-------|------------|
| 1 | Atom typing | **Unified `Atom{kind}`**, but the **probe uses only `system\|model\|claim`** (review 2/3). `exercise/misconception/term/example` and the `assesses/remediates/example_of` predicates are deferred until the gate (§6) says build more — specifying them now is the same premature-precision sin as the old credibility score. |
| 2 | `provenance` as a kind? | **No.** It's `SourceAnchor` + `DerivationRun` + review state. A quote is an anchor excerpt; a "fact" is a `claim` with an anchor. |
| 3 | Trust = verifiable anchor? | **No — necessary, not sufficient (review 1, best catch).** `verifiable` only proves the excerpt re-derives from its selector, not that it *supports* the atom. Add a reviewed **`support_state`** per (atom, anchor): `supports \| partially \| does_not_support \| disputed`, and **claim-support accuracy** to eval. A correct citation of the wrong claim is still wrong. |
| 4 | Trust signals | Layered: computed `verifiable` (cheap, automatable) + reviewed `support_state` + aggregate signals (citation density, disputes) later. |
| 5 | Phase 0 = schema | **Thin *evaluation pack contract v0*, not the canonical ontology** (all three reviews). Ugly enough to ship, strict enough to measure. |
| 6 | Phasing | **Contract → CLI → editor**, with the eval gate as the Phase-1 exit (you can't measure grounding through a UI). |
| 7 | Backend / stack | **Decide now: none yet.** Pack contract is **storage-independent — JSON files + JSON-Schema validator + a CLI** for Phase 0/1 (review 2/3). The Go+SQLite+asof question is the long pole; **timebox the asof audit to 1 day** (§6) and decide after. This is the v1 fix to "the decision record didn't decide the least-reversible thing." |
| 8 | Tutor | A **proof surface, not the center** (review 1/3). It demonstrates the artifact is grounded; it is not the differentiator. |
| 9 | Review | Not just a state — **the product workflow** (review 2). Define it: accept / edit / split / reject an atom, jump to source span, mark unsupported, diff vs. generated, publish. |

## 4. Verified defects in the current spike (basis for "reset")

Confirmed by inspection (file:line), not assumed:
- `EditEntityDialog.tsx:32,151,166–169` — invalid `Model['type']` (`mental/conceptual/
  paradigm`) and `System['status']` (`deprecated`) values.
- `Detail.tsx:4,6,7` — imports missing `Badge` and nonexistent `getSystem`/`getModel`
  (modules export `…ById`).
- Two divergent KBs; app loads the 23-entry `app/public/data/…yaml`, not the 157-entry one.
- `import-data.ts:99,119,142` — discards YAML `id`, mints a new one → permalinks and
  package identity broken at the root.
- `db/index.ts` — sql.js WASM fetched from a CDN, breaking the offline claim.

## 5. Minimum probe schema (v0)

The contract is **encoded, not described**: `spec/learning-pack.schema.json` (JSON Schema
2020-12), with a validated example at `spec/examples/`. Shape:

- **Atoms:** `system | model | claim` only. Each references anchors as `{anchor_id,
  support_state}`.
- **Anchors:** `verifiable` is *computed* (excerpt re-derives from its selector);
  `support_state` (`supports | partially | does_not_support | disputed`) is the *reviewed*
  judgment that the excerpt backs *that* claim. Verifiable is necessary, not sufficient
  (review 1).
- **Relationships are grounded too** (review B's catch): edges carry `review_state`,
  optional `anchor_ids` + `support_state`; the tutor traverses only `reviewed` edges, and
  `relationship_precision` is in eval. Hallucinated `requires`/`contradicts` edges are fake
  structure in a *graph* product.
- **DerivationRun logs `cost {tokens_in, tokens_out, usd}`** (review A — was dropped) so the
  probe reports `usd_per_published_atom` — half of "is it worth it."

Publish invariant: a `published` atom needs ≥1 anchor with `support_state = supports` (not
merely `verifiable`) and `review_state ∈ {reviewed, published}`; only `reviewed` edges are
traversable. JSON Schema covers the structural v0 shape; a Day 1-2 graph-level validator
must enforce publish invariants, reference integrity, and reviewed-only traversal before
the probe treats a pack as valid. The example pack is shaped to pass those checks.

Honest note (review A): `support_state` *relocated* the subjective trust call to the right
place (per atom-anchor) — it did not remove it. `claim_support_accuracy` therefore needs its
own gold standard, compounding the gold-set burden in §6.

**Deferred until the gate says build more:** `exercise/misconception/term/example` kinds,
`assesses/remediates/example_of` predicates, `learning_level`, C2PA, embeddings, aggregate
review summaries, any backend.

## 6. The probe — two tracks, gated (not merely parallel)

v1 ran the tracks in parallel; review A caught the confound — Track A measures *realized*
pipeline output, but a Track B run on a hand-polished pack tests a *different* artifact, so
"they liked it" wouldn't mean "they like what the pipeline makes." Gate them.

**Track A — supply / extraction quality (CLI).**
`one source → CLI extract → validated pack v0 → anchors with support_state → grounded tutor
(cite-or-refuse) → eval numbers.`

- **Gold set first, ≥2 annotators on a subset** — a single annotator just re-imports the
  `credibility_score` subjectivity; report inter-rater agreement (review A).
- **Baseline arm** — run NotebookLM (or a naive single-prompt, no-anchor extraction) on the
  *same* source. The gate that matters is "**better than the free alternative**," not an
  absolute number (review A).
- **Pre-registered provisional thresholds** (commit before the run; provisional, not
  sacred — review C): extraction precision/recall, claim-support accuracy, anchor precision,
  grounding accuracy, **refusal correctness on a fixed ≥20-question out-of-scope set (its own
  threshold ≈0.9)** (review B), relationship precision, and — read *against the gold set and
  the baseline*, never alone — median minutes and usd per published atom.

**Track B — demand + curation-burden moat (concierge, behavioral).** Two sub-steps, because
the hand-built version can only *kill*, not *confirm*:

- **B0 — kill gate (early, hand-built).** Put 1–2 hand/AI-built packs before 3–5 *named*
  learners/creators on a real review surface (not raw JSON — see doc 12). If even friendly
  users won't engage, the idea is dead (valid disconfirmation). Engagement here is **not** a
  green light: politeness bias, n≈4, idealized artifact.
- **B1 — weak confirm (after A passes).** Put Track A's *actual* output before users and
  watch behavior on the real artifact. The only honest positive signal — and it exists only
  if A clears its gate.

**Decision:** go only if A **beats the baseline** on the committed thresholds **and** B1
shows someone will curate the *real* output. A great edit rate with no willing curator is a
no-go — or a reshape to a *creator* tool (the A-vs-B fork in §1.1, still owed after the
probe; the probe surfaces it, it doesn't take it).

---

Executable version: `docs/12-operating-brief-v0.md`. Encoded contract:
`spec/learning-pack.schema.json` (+ validated example).
