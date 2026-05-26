# Wedge Spec: Source → Learning Pack

> **Superseded in part by `docs/11-best-of-breed-synthesis.md`.** The synthesis adopts a
> unified atom model (and corrects the object model below) after reconciling with the Codex
> pass. Read 11 for the settled object model and phasing; this doc remains useful for the
> anchor/locator detail, drift detection, copyright table, and evaluation metrics.

Concrete follow-on to `docs/09-revisit-2026.md`. Where 09 is the executive memo, this is
the buildable slice: one vertical demo, end to end. Incorporates the PR #1 review.

**Framing (from review):** build an **A-shaped product** (a useful learning/editor tool)
that produces a **B-shaped artifact** (a portable, verified knowledge graph format). The
product earns adoption; the artifact is the substrate that later carries the registry /
MCP / lingua-franca plays. Artifact first, interface second.

**Scoping stance:** define the full model here, but ship a deliberately thin v1 (§11). In
particular, the *learning-science* layer (misconceptions, spaced retrieval, exercises) is
specified in §8 but **deferred to v2** — v1 proves anchored extraction + source-linked
editing + grounded tutor + portable pack.

---

## 1. The vertical, end to end

```
Ingest → Segment → Extract → Curate → Assemble → Publish → Query
  │         │         │         │         │         │         │
source   transcript  candidate  human    pack.json  shareable grounded
artifact + locators  atoms +    accept/  (atoms +   pack      tutor
                     anchors    edit/    edges +              (cite-or-
                     (queue)    reject   anchors +            refuse)
                                         derivations)
```

Every stage appends a **derivation event** (§4) so the whole chain is replayable and
diffable — the `asof` event-log/fork/diff model applied to provenance-of-derivation.

**Demo source for v1:** pick *one* kind. Recommended: a **user-owned AI conversation**
(via `asof`) or a **CC/openly-licensed talk**. Both sidestep the copyright problem (§9)
while exercising the full pipeline. Design the pipeline source-agnostic so YouTube/podcast/
paper slot in later.

---

## 2. Core data model — atoms

```ts
type AtomType = 'system' | 'model'        // procedural | conceptual
type Lean     = 'procedural' | 'conceptual' | 'mixed'
type Review   = 'extracted' | 'proposed' | 'human_verified' | 'disputed' | 'superseded'

interface Atom {
  id: string
  type: AtomType
  lean: Lean                  // soft signal; we stop forcing the system/model binary
  title: string
  body: string                // human-readable; for systems, structured steps
  steps?: Step[]              // systems only: ordered, each step can carry its own anchor
  anchors: AnchorId[]         // ≥1 to be publishable; 0 = "unanchored" warning state
  edges: EdgeId[]
  review: Review
  derivation: DerivationId    // how this atom came to exist
  version: int                // monotonic; supersession is explicit, old versions kept
  authored_by: 'ai' | 'human' | 'mixed'
}

interface Edge {
  id: string
  from: AtomId; to: AtomId
  rel: 'uses' | 'requires' | 'explains' | 'extends' | 'contradicts' | 'supports' | 'evidences'
  anchors?: AnchorId[]        // an edge can itself be source-justified
}
```

Note: provenance is **no longer a node type** with a typed `credibility_score`. It is the
`Anchor` (§3) attached to atoms/edges, plus the `Derivation` lineage (§4). This is the
single most important model change from the current app.

---

## 3. Source & anchor model

```ts
interface Source {
  id: string
  kind: 'video' | 'podcast' | 'paper' | 'conversation' | 'web'
  uri: string
  title: string
  rights: { license?: string; access: 'owned' | 'open' | 'restricted' }
  media_hash?: string         // integrity / re-verification
  retrieved_at: timestamp
}

type Locator =
  | { kind: 'time_range'; start_ms: int; end_ms: int }            // av media
  | { kind: 'text_span';  transcript_version: string; start: int; end: int }
  | { kind: 'page_region'; page: int; bbox: [number,number,number,number] }  // pdf
  | { kind: 'message_ref'; conversation_id: string; message_id: string; span?: [int,int] }

interface Anchor {
  id: string
  source: SourceId
  locator: Locator
  quote: string               // the exact supporting text/caption, stored inline
  extraction_method: 'asr' | 'ocr' | 'native_text' | 'human'
  verifiable: bool            // see check below
}
```

**Verifiability is computed, not asserted.** An anchor is `verifiable` iff `quote` can be
re-derived from `locator` against the stored source artifact (string match within tolerance
for ASR/OCR). This replaces the made-up 0–100 score with a checkable boolean + the raw
anchor the human/agent can judge. Trust then accrues from (a) verifiable anchors and (b)
**corroboration count** — how many independent sources anchor the same claim.

---

## 4. Derivation lineage (the `asof` reuse)

```ts
interface Derivation {
  id: string
  op: 'ingest' | 'segment' | 'extract' | 'edit' | 'merge' | 'split' | 'publish'
  inputs: (SourceId | AtomId | DerivationId)[]
  outputs: (AtomId | AnchorId | PackId)[]
  actor: 'ai' | 'human'
  model?: string              // model id + version when actor = ai
  prompt_hash?: string        // reproducibility
  diff?: JsonPatch            // for edit/merge/split
  at: timestamp
}
```

The derivation log is append-only and forms a DAG (an atom can be a merge of two
proposals; an edit forks a version). This is exactly `asof`'s territory. Two payoffs:

- **Honest provenance**: "this atom was machine-extracted from source X, then edited by a
  human on date Y" is first-class, not folklore.
- **Replay/diff**: re-run extraction with a better model and *diff* against the curated
  version to measure drift and re-surface only what changed.

---

## 5. Source-linked editor (primary work surface)

- **Block-based** (Tiptap/ProseMirror/Lexical — TBD §12). Each block *is* an Atom.
- Selecting a block reveals its anchors; clicking an anchor **opens the source at the
  locator** — video seeks to the timestamp, transcript highlights the span, PDF scrolls to
  the bbox. This is the moment that sells the whole thing.
- AI proposals land in a **review queue**, not directly in the doc. Human actions:
  accept / edit / reject / merge / split — each writes a Derivation.
- **Unanchored claim** = first-class warning state; can't publish until resolved or
  explicitly marked `authored_by: human` synthesis.
- **Drift detection**: if an edited atom body diverges from its anchor quote beyond
  tolerance, flag "drifted from source" → must re-anchor or reclassify as human synthesis.

---

## 6. Trust workflow

State machine: `extracted → proposed → human_verified → published`; plus `disputed` and
`superseded` as off-ramps.

- **Disputed anchors**: a reviewer (or, later, any consumer) can flag that an anchor does
  not support its claim. Disputes are visible in the editor and ride along in the pack.
- **Supersession is explicit**: editing creates a new version; the old one is retained and
  remains queryable "as of" its time (ties to the evolution-tracking goal from docs 01/03).
- **Trust signals** surfaced to the user: `verifiable` anchor ratio, corroboration count,
  authored_by, age, dispute flags. We **show the evidence and let the human/agent judge** —
  we do not synthesize a single trust number (that was the original sin).

---

## 7. The grounded tutor (query layer)

**Hard contract:** every assertion in an answer must cite ≥1 atom, and every cited atom
carries its anchor. If no atom supports the question, the tutor responds *"this pack
doesn't cover that"* rather than answering from base-model knowledge. Refusal is success.

- **Retrieval is graph-aware**, not flat chunks: resolve the question to atoms, then pull
  neighbors (prereqs, supporting/contradicting atoms) + anchors. *(This is the
  "product-grade retrieval" the review flagged — conceded as real work, not a freebie.)*
- **Modes:** `Explain` (concept), `How-to` (system steps), `Trace` (walk the provenance
  chain), `Quiz` (generate questions from atoms). **v1 ships Explain + Trace.** How-to and
  Quiz follow once the learning layer (§8) lands.

---

## 8. Learning layer (specified, deferred to v2)

Full model so the data shape is right now even though we don't build the UX yet:

- **Prerequisites**: `requires` edges drive ordering and "you should learn X first."
- **Misconceptions**: model atoms flagged `is_misconception: true`, linked via
  `contradicts` to the correct atom — the tutor can pre-empt and correct them.
- **Retrieval practice**: questions generated *from atoms* (so answers are gradable against
  anchors), scheduled with spaced repetition.
- **Worked examples**: instances attached to system atoms.

**v1 builds only the `requires` edges** (cheap, and they make Explain feel like a path).
Everything else here is v2 — building it in v1 would balloon scope past "one vertical."

---

## 9. Copyright / licensing reality

The pack stores **source references + locators + derived atoms (our own expression) +
minimal fair-use quotes** — never redistributed full media or full transcripts.

| Source kind | Stance |
|---|---|
| Own AI conversations (`asof`) | Cleanest — user owns it. **Best first source.** |
| CC / openly-licensed talks | Safe. Good demo material. |
| YouTube / podcasts (general) | Transcript is derivative; published pack links out + quotes minimally; never host media. |
| Papers | Prefer OA; anchor to page/quote; respect publisher terms. |

The pack manifest carries a `license` and per-source `rights`; publishing/sharing honors
them. This is a real constraint, not a footnote — it shapes which sources we open with.

---

## 10. Evaluation (beyond vibes)

Automatable first, human last:

1. **Anchor precision** — % of anchors whose stored `quote` actually occurs at the
   `locator` in the source. Fully automatable; should approach 100%.
2. **Grounding / citation accuracy** — % of tutor assertions that resolve to a real
   atom+anchor (zero fabricated citations). Target 100%.
3. **Refusal correctness** — on a curated out-of-scope question set, does the tutor refuse
   instead of hallucinating?
4. **Extraction precision/recall** — machine-proposed atoms vs. a human gold set for the
   demo source.
5. **Human edit rate** — how much curation each proposed atom needs (proxy for extraction
   usefulness; also drives the replay/diff loop in §4).
6. **Tutor helpfulness** — small rubric-based human eval. Last resort, explicitly the
   vibes-adjacent one.

---

## 11. Thin v1 build slice

Ship exactly this, nothing more:

1. **One** source kind end to end (user AI-conversation *or* one CC talk).
2. Transcript/segment store with `text_span` + `time_range` locators.
3. Extraction prompt → candidate system/model atoms + anchors into a **review queue**.
4. Source-linked editor: accept/edit/reject; click anchor → seek source.
5. `requires` edges only.
6. Pack export (`pack.json`): atoms + edges + anchors + derivations + manifest.
7. Grounded tutor: **Explain + Trace**, hard citation contract, refusal on out-of-scope.
8. Eval harness: anchor precision + grounding accuracy + refusal set (§10 #1–3).

**Explicitly out of v1:** registry/marketplace, MCP server, multi-author sync, the full
learning layer (§8 beyond prereqs), multi-source corroboration UI, the graph canvas as a
primary surface.

---

## 12. Open questions

1. First demo source kind — own AI conversation vs. CC talk.
2. Editor stack — Tiptap vs. ProseMirror vs. Lexical.
3. Retrieval/embedding + storage infra (Postgres+pgvector vs. Turso/libSQL).
4. How much of `asof` to lift for the derivation log vs. build fresh.
5. Pack format — bespoke JSON vs. align to JSON-LD / schema.org for portability.
6. Where the AI extraction runs (cost/latency/rights) and which model.
