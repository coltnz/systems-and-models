# Revisit Report — May 2026

Picking this up after a long hiatus. This doc supersedes the framing in docs 01–08
where they conflict. It is a strategy/status snapshot, not a committed plan — the
direction is still open and being explored.

---

## 1. Where it actually stands

**The idea (unchanged):** three node types — Systems (*what to do*), Models
(*what to know*), Provenance (*why / sources*) — connected by typed edges, rendered
as a graph, local-first, with marketplace / "lingua franca" ambitions.

**The implementation:** a competent throwaway prototype (~4,600 LOC).

- React 19 + Vite + Tailwind v4 + shadcn, `sql.js` (SQLite in WASM) running **in the
  browser**, persisted as a blob in IndexedDB.
- Cytoscape with a **COSE force-directed layout** as the primary view.
- 110+ curated entries importable from YAML.
- "Search" is **keyword scoring** (`src/lib/search.ts`) — no embeddings, no semantics.
- Provenance "credibility" is a hand-typed `0–100` integer.
- **Zero AI anywhere.** No ingestion, no extraction, no tutoring, no agent interface.

It validated the data model and nothing else. Treat it as a paper prototype, not a
foundation. Three structural reasons:

1. **sql.js-in-browser + IndexedDB blob** rewrites the entire DB on every save. Fine for
   110 nodes, dead-end for a multi-device, multi-author, AI-fed graph.
2. **Force-directed graph as the home screen** is the classic knowledge-graph trap — it
   becomes a hairball that looks impressive and helps nobody learn. (doc 07 admits this.)
3. **Provenance is cosmetic.** A typed-in `credibility_score: 95` is fake precision, not
   trust. Real provenance is *link + anchor (timestamp/quote/page) + how it was extracted
   + whether it's checkable*.

---

## 2. What changed in the ~16 months away

The world moved *toward* the thesis, but moved the goalposts too.

- **MCP (Model Context Protocol) emerged as the leading way to connect tools/data to
  LLMs.** This is the eventual mechanism for "plug in everywhere / lingua franca" — but
  it's a *distribution/interface* play that pays off **after** the artifact is useful, not
  the wedge itself. Build the valuable artifact first; expose it over MCP second.
- **GraphRAG went mainstream.** "Use a structured knowledge graph to make LLM answers
  grounded and traceable" is now a published, recognized technique. The core bet — *graphs
  make AI knowledge trustworthy* — is validated. Flip side: no longer contrarian.
- **Cheap/local embeddings + WebGPU.** Basic semantic search (local or near-free API) is
  now easy. But the hard part isn't embeddings — *trusted, source-anchored, versioned,
  graph-aware retrieval* is still product-grade work. Don't mistake the easy 20% for the job.
- **Transcription is largely a commodity — for text.** YouTube/podcast → rough transcript
  is cheap. Accurate **timestamps, speaker turns, slides/diagrams, rights, and quote-level
  citation accuracy** are not solved, and are exactly what provenance needs. Buildable,
  not free.
- **"Deep research" agents** already synthesize sources with citations. Competitor *and*
  opening: they produce **disposable prose with links**, not a reusable, typed, queryable
  artifact.
- **Everyone added AI notes** (Notion, Obsidian, …). The generic "AI PKM tool" lane is now
  a red ocean. Building Obsidian-with-provenance into that lane is a losing race.

**Net:** technology risk collapsed, the idea got validated — but the "beautiful local PKM
app" framing is now the *weakest* part of the plan, not the strongest.

---

## 3. The honest read on the idea

**Still right:**
- The **provenance layer** is the durable differentiator. In an AI-saturated world,
  "show me the receipts, anchored to a real source" is worth more every month.
- **Systems vs. Models** (procedural vs. conceptual) is a useful typing that generic
  notes / RAG chunks lack. Agents *want* "the proven procedure for X" separate from "the
  concept behind it."
- **Videos/podcasts → graph** is the best wedge (see §5).

**Now wrong or weak:**
- **"Knowledge for the AI future" is still too vague** (doc 07 flagged this; still
  unresolved). Replace with a concrete verb/loop.
- **Systems/Models overlap** still unresolved ("scientific method" — system or model?).
  Recommendation: keep both types but stop forcing a binary; let a node carry a
  `procedural`/`conceptual` lean and let provenance do the heavy lifting.
- **Marketplace** — same chicken-and-egg. Reframe as a **registry** (npm/HuggingFace:
  free distribution first, money much later). Liquidity is the whole game; we don't have it.
- **"Lingua franca"** is *earned*, not *declared* — by being (a) the easiest way to
  **produce** these graphs and (b) trivially **consumable** (MCP + clean export).

---

## 4. The strategic fork

Two genuinely different products hide in the vision; the old docs never forced the choice.

- **A. A human learning app** — Obsidian-with-provenance + an AI tutor. Familiar,
  demoable, but a red ocean now.
- **B. A verifiable knowledge *substrate* for AI** — a typed, citation-anchored graph
  format + a reference editor + an MCP server, so agents and humans co-author trustworthy
  procedural/conceptual knowledge. Blue ocean, on-thesis with lingua-franca / marketplace,
  harder to demo.

**Leaning recommendation (not yet decided): build an A-shaped *product* that produces a
B-shaped *artifact*** — a genuinely useful learning/editor tool first, with a portable
verified graph format underneath. Enter through one concrete wedge:

> **Drop in a YouTube video, podcast, or paper → get back a verified graph of its Systems
> and Models, every claim anchored to a clickable timestamp/quote. Then ask an AI tutor
> that can only answer *from* that graph, with citations.**

That single feature:
- Solves the **cold-start** problem the old docs agonized over (the graph builds itself).
- Makes **provenance real** (timestamp + quote, not a typed score).
- Produces a **shareable artifact** (the per-source graph) that seeds the registry.
- Demonstrates **trust / anti-hallucination** viscerally (the tutor can't invent; it cites
  the clip).
- Is the **producer** side of the lingua-franca play; an MCP server (later) is the
  consumer side. Artifact first, interface second.

This is the "process to make things concrete": **Ingest → Extract (AI) → Curate (human) →
Connect → Verify.** That loop *is* the product.

---

## 5. What it should be (concrete shape)

- **Source-connected editor**, not a graph canvas, as the primary surface. Block-based
  (ProseMirror / Tiptap / Lexical) where blocks *are* typed nodes (System block, Model
  block, Provenance/citation block). You curate; AI proposes the decomposition and attaches
  sources inline. Graph view becomes a *secondary lens* — the single biggest UX correction
  vs. the current build.
- **Provenance redefined** as `{ source, anchor (timestamp/quote/page), extraction_method,
  verifiable: bool }`. Kill the made-up integer; let trust emerge from checkable anchors +
  corroboration count.
- **AI tutor / Q&A grounded in the graph** (GraphRAG): answers cite nodes; "I don't have a
  source for that" is a first-class answer.
- **MCP server** (later) exposing read (`query_systems`, `get_provenance`) and write
  (`propose_node`) — the distribution/interface layer, *after* the artifact earns its keep.
- **Registry, not marketplace** (v1): publish/import graphs by URL, attribution baked in.
- **Real backend** (Postgres + pgvector, or Turso/libSQL if we love SQLite) for
  multi-device, multi-author, embeddings — replacing the in-browser blob.

---

## 6. The `asof` connection (corrected)

`asof` is an AI "debugger" — a view over your AI conversations with a physics engine to
navigate the conversation graph. It is **not** a storage layer. Two real links:

1. **AI conversations as a first-class source.** Your own AI chats are a goldmine of
   systems (procedures worked out with a model) and models (concepts learned). `asof`
   already captures/views them, so it could be an **upstream source** feeding the
   ingest→extract→verify loop: *"extract the reusable systems/models from this
   conversation, provenance = the conversation."*
2. **Graph-navigation UX precedent.** The physics-engine navigation is good for *exploring
   a bounded graph* (a single conversation tree). Note the nuance: that's exactly why it
   should stay a *secondary explore mode*, not the authoring home screen — the force-graph
   hairball problem (§1) applies the moment the graph is the whole corpus rather than one
   conversation.

3. **Event-log / fork / diff model for derivation lineage.** This is the strongest reuse,
   stronger than the nav UX. A pack is the end of a chain — transcript → machine extraction
   → human edit → published pack — and that chain is exactly the event-log + fork + diff
   structure `asof` already models. Provenance isn't only *which source*, it's *how this
   atom was derived and by whom*. Lift that lineage model rather than reinventing it.

There may also be a shared graph-rendering / physics-nav component worth reusing across both.

---

## 7. Bottom line

- **Idea:** still good, better-validated than 2025; needs the vague "AI future" framing
  replaced with the concrete ingest→verify→tutor loop.
- **Tech landscape:** moved in our favor (MCP, GraphRAG, cheap embeddings, commodity
  transcription) — the *plumbing* got easy. The hard, defensible work (anchored extraction,
  trusted graph-aware retrieval, the trust workflow) is still the job.
- **Implementation:** rebuild. The current app is a model-validation demo; its three core
  choices (browser sql.js, force-graph-as-home, fake credibility scores) are all wrong for
  the new vision.
- **Wedge:** "source → verified Systems+Models graph + grounded tutor." Build that and the
  registry / lingua-franca / marketplace become downstream consequences, not upfront bets.

## 8. Open questions to resolve before committing

1. Substrate (B) vs. learning app (A) vs. pure protocol — still open.
2. Single-player learner first, or agent/MCP consumer first?
3. Storage: Postgres+pgvector vs. Turso/libSQL — depends on multi-author timing.
4. How much of `asof` (sources + nav UX) to reuse vs. build fresh.
5. Editor stack: ProseMirror vs. Tiptap vs. Lexical for typed-block authoring.
6. Provenance trust model: corroboration count, verifiability flags — how computed, if at
   all (vs. just showing the anchor and letting the human judge).

---

**Next:** `docs/10-wedge-spec-source-to-learning-pack.md` converts this memo into a
buildable vertical slice (data model, anchor/locator model, derivation lineage, pack
format, trust workflow, copyright stance, evaluation, and a thin v1).
