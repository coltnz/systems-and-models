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

## 5. Minimum probe schema (v0 — only what §6 needs)

```
SourceAsset { id, uri, media_type, title, creator, license, access(owned|open|restricted),
              content_hash }

SourceAnchor { id, source_asset_id,
               selector{ kind(text_quote|timestamp_range|page_range), start, end },
               excerpt, extraction_method(asr|native|human),
               verifiable: bool }                      # COMPUTED: excerpt re-derives from selector

Atom { id, kind(system|model|claim),                   # nothing else for the probe
       title, summary, body,
       steps?[]                                         # systems only
       review_state(generated|edited|reviewed|rejected|published),
       authored_by(ai|human|mixed),
       anchors: [{ anchor_id, support_state(supports|partially|does_not_support|disputed) }],
       derivation_id, version }

Relationship { id, from_atom_id, to_atom_id,
               predicate(uses|requires|explains|supports|contradicts),
               review_state }

DerivationRun { id, op(ingest|extract|edit|publish), input_ids[], output_ids[],
                actor(ai|human), model_name?, model_snapshot?, prompt_hash?,
                schema_version, created_at }

LearningPack { id, title, version, license, schema_version,
               sources[], atoms[], relationships[], derivations[],
               eval{ anchor_precision, claim_support_accuracy,
                     extraction_precision, extraction_recall,
                     grounding_accuracy, refusal_correctness,
                     median_minutes_per_published_atom, accept_edit_reject_ratio } }
```

Publish invariant: a `published` atom needs ≥1 anchor with `support_state = supports`
(not merely `verifiable`) and `review_state ∈ {reviewed, published}`.

**Deferred until the gate says build more:** `exercise/misconception/term/example` kinds,
`assesses/remediates/example_of` predicates, `learning_level`, C2PA, embeddings, aggregate
review summaries, any backend.

## 6. The probe — two tracks, run in parallel

The v1 single-track build-the-pipeline move was the supply-side reflex this doc warns
against. Split it:

**Track A — supply / extraction quality (the CLI).**
`one source → CLI extract (structured output) → validated pack v0 → anchors with
support_state → grounded tutor (cite-or-refuse) → eval numbers`.
The gate is **not** edit rate alone (gameable — accepting slop minimizes it). It is the
gold-set composite below.

- **Build the gold set first:** a domain-competent reviewer hand-authors the "true" atom set
  for one 20–40 min segment. This defines "usable atom" and makes the metrics falsifiable.
- **Metrics & provisional kill thresholds (commit the numbers *before* the run):**
  - extraction precision / recall vs gold set — *kill if precision < ~0.6 or recall < ~0.5*
  - claim-support accuracy (anchor actually supports the atom) — *kill if < ~0.8*
  - anchor precision (excerpt re-derives) — *kill if < ~0.95* (cheap, should be near-perfect)
  - grounding accuracy / refusal correctness (tutor proof surface) — *kill if grounding < ~0.95*
  - median minutes per published atom + accept/edit/reject ratio (effort, *interpreted
    against the gold set*, not alone)
  - (placeholders — the point is they are set and committed before building, not that these
    exact values are right.)

**Track B — demand + curation-burden moat (concierge, behavioral, cheaper than A).**
Hand- or AI-build 1–2 packs on topics a *real target user* cares about; put them in front
of 3–5 real learners/creators. Measure **behavior, not opinions**: do they open the source
from an anchor, fix/reject any atoms, return, share it, and would they have built it
themselves? This is the only cheap test of §1.1 and §1.3.

**Decision:** go/no-go against the committed thresholds *and* whether Track B shows anyone
will curate. A great edit rate with no one willing to curate is still a no-go.

---

The immediately-executable version of all this is `docs/12-operating-brief-v0.md`.
