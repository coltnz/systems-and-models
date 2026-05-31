# 2026 Revisit: AI Learning, Source Graphs, and Systems/Models

Date: 2026-05-26

## Executive Summary

The original instinct is still strong, but the product should be reframed.

Do not build another personal knowledge graph app. Build a source-to-learning-graph studio: a tool that turns trusted sources such as books, papers, YouTube videos, podcasts, course notes, and conversations into structured, reviewable learning graphs.

The durable idea is:

- Systems = what to do.
- Models = what to know.
- Provenance = why we should trust it, where it came from, and how it was derived.

The new opportunity is that current models can ingest long, multimodal sources, produce schema-constrained output, use tools, cite files, understand audio/video, and generate tutoring interactions. That makes the old vision much more feasible. The hard part has moved from "can AI extract this?" to "can we make extracted knowledge trusted, editable, inspectable, teachable, and portable?"

Recommended direction:

1. Keep the systems/models/provenance ontology, but make provenance and source anchors the product center.
2. Treat the current implementation as a useful spike, not the production foundation.
3. Borrow the `../asof` mental model: immutable events, as-of state, lineage, inspector, fork/diff.
4. Build a canonical package format and editor before building a marketplace.
5. Make YouTube/podcast/paper ingestion the wedge, with human review as the trust layer.

The shortest useful product:

> Paste a YouTube/podcast/paper/source. The app extracts systems, models, claims, prerequisites, exercises, and provenance anchors. The user reviews them in a sophisticated editor, fixes the graph, and exports a portable learning pack.

## What Changed Since the Hiatus

### Model Capabilities Are Now Aligned With This Product

Current public model platforms now support the primitives this idea needed:

- OpenAI's public model docs list GPT-5.2 as a current frontier model for complex reasoning and agentic tasks, with 400k context, structured outputs, tool use, file search, code interpreter, image input, and related audio/transcription models. The platform also has schema-constrained structured outputs and hosted file search with semantic plus keyword retrieval. Sources: [OpenAI models](https://platform.openai.com/docs/models), [GPT-5.2](https://platform.openai.com/docs/models/gpt-5.2/), [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs), [File search](https://platform.openai.com/docs/guides/tools-file-search/), [Speech to text](https://platform.openai.com/docs/guides/speech-to-text).
- Anthropic's current Claude docs list Claude Opus 4.1 and Sonnet 4, with 200k context and a 1M context beta for Sonnet 4, plus vision, extended thinking, tool use, citations, and computer-use style agent loops. Sources: [Claude models overview](https://docs.anthropic.com/en/docs/about-claude/models/overview), [Claude features](https://docs.anthropic.com/en/docs/build-with-claude/overview), [Claude vision](https://docs.anthropic.com/en/docs/build-with-claude/vision), [Computer use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool).
- Gemini is especially relevant for video. Gemini docs describe multimodal input including text, image, audio, video, PDF, 1M-token context on Gemini 3 Pro/Flash previews, structured output, function calling, and direct YouTube URL processing in preview. Sources: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Video understanding](https://ai.google.dev/gemini-api/docs/video-understanding), [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Function calling](https://ai.google.dev/gemini-api/docs/function-calling).

Implication: turning long videos, podcasts, and papers into structured graph proposals is now a normal engineering problem, not a moonshot.

### Learning Evidence Supports "Structured AI Tutor", Not "Generic Chatbot"

The strongest educational signal is not "AI answers questions." It is "AI works when scaffolded."

- A 2025 Scientific Reports randomized controlled trial in a Harvard physics course found a custom AI tutor produced significantly higher learning gains in less time than an active learning class. The key detail is that the tutor was carefully structured around pedagogy, scaffolding, stepwise activities, and expert-written solutions. Source: [Scientific Reports AI tutoring RCT](https://www.nature.com/articles/s41598-025-97652-6).
- A 2025 PNAS field experiment in high school mathematics found that unguarded generative AI can harm learning, while a more constrained GPT Tutor mitigated much of the harm. Source: [PNAS guardrails study](https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/).
- OpenAI's Study Mode and Khanmigo point at the same market pull: guided, step-by-step tutoring rather than answer delivery. Sources: [ChatGPT Study Mode](https://openai.com/index/chatgpt-study-mode/), [Khanmigo](https://www.khanacademy.org/khan-labs).
- NotebookLM shows the mainstream appetite for source-grounded study tools, including source-based summaries, questions, study guides, and audio overviews. Source: [Google on NotebookLM](https://blog.google/technology/ai/developing-notebooklm/).

Implication: systems/models should not be just knowledge display. They should become the substrate for guided learning: prerequisites, checks for understanding, retrieval practice, exercises, misconceptions, worked examples, and "show source" at every step.

### Provenance Standards Are Mature Enough To Borrow, Not Own

The product should not invent every trust primitive.

Useful standards:

- W3C PROV provides a vocabulary for provenance interchange. Sources: [PROV-DM](https://www.w3.org/2012/10/prov-dm), [PROV-O](https://www.w3.org/TR/2013/PR-prov-o-20130312/).
- RDF/JSON-LD are useful for graph interchange, but should be an export/interoperability layer, not the internal authoring experience. Source: [RDF 1.2 Concepts](https://www.w3.org/TR/rdf12-concepts/).
- SHACL is relevant for validating graph constraints. Source: [SHACL](https://www.w3.org/TR/shacl/).
- C2PA Content Credentials is relevant for media provenance and authenticity, especially for generated/edited media. Source: [C2PA specifications](https://spec.c2pa.org/).
- Schema.org `LearningResource` helps publish packs and lessons in a web-native way. Source: [Schema.org LearningResource](https://schema.org/LearningResource).
- Open Badges 3.0 matters later if learning packs produce verifiable achievements. Source: [1EdTech Open Badges](https://www.1edtech.org/standards/open-badges).

Implication: design a simple internal JSON package first, with JSON-LD/PROV/schema.org/C2PA mappings at the boundary.

## Verdict On The Old Idea

### Keep

- The systems/models/provenance triad.
- The ambition to become a lingua franca for concrete learning knowledge.
- Local-first ownership and portable packages.
- Graph navigation, but as one mode among several.
- Import/export and bundles.
- Marketplace as a possible outcome, not an MVP feature.
- YouTube and podcast conversion as a core wedge.

### Change

- Put sources and source anchors first. The unit of trust is not a node. It is the connection between a node, a source span, an extraction run, and a human review state.
- Treat AI output as proposals. "Generated" and "reviewed" must be different states.
- Make learning artifacts first-class: exercises, misconceptions, checks, prerequisites, explanations, examples, and practice schedules.
- Replace subjective `credibility_score` with computed review completeness and provenance quality signals.
- Make "systems vs models" a user-facing distinction, but not a database split that causes schema drift.

### Delay

- Marketplace.
- Social/collaboration.
- Full RDF-first semantic web stack.
- Rich 3D or global force graph demos.
- Pure browser SQL.js as the serious ingestion backend.

## Current Implementation Review

The implementation has useful pieces:

- Systems, models, provenance, relationships.
- Import from YAML.
- Graph view with semantic zoom.
- Search and permalinks.
- Local SQLite-in-browser persistence.
- Event records for entity changes.

But it should be treated as a prototype spike.

Static check result:

```text
npx tsc -b --noEmit
```

currently fails with type and wiring issues, including:

- `EditEntityDialog` uses invalid model enum values such as `mental`, `conceptual`, and `paradigm`, while the canonical type allows `mental-model`, `concept`, `framework`, and `principle`.
- `EditEntityDialog` offers `deprecated` for systems while the type allows `draft`, `active`, `archived`, and `proven`.
- `Detail.tsx` imports a missing `badge` component and non-existent `getSystem`/`getModel` exports.
- `sql.js` and `react-cytoscapejs` are missing type declarations.
- The DB module imports unused types and has implicit `any` sites.

Other architectural issues:

- Import loses stable IDs. The YAML `id` is not preserved as the entity ID; new IDs are generated. That breaks stable permalinks and marketplace/package semantics.
- There are two sample knowledge bases with very different scope: `data/sample-knowledge-base.yaml` is large, while `app/public/data/sample-knowledge-base.yaml` is much smaller. The app loads the smaller one.
- `sql.js` WASM is loaded from `https://sql.js.org/dist/${file}`, which weakens the local-first/offline story.
- Provenance is stored as a broad node type, but there is no source span/timestamp selector, no derivation run, no prompt/model hash, no review workflow, and no license/rights model.
- The graph is a graph display, not yet an editor. The main product needs source review and graph repair more than a global network view.

Recommendation: do not continue piling product features into this app until the schema/package contract is reset.

## `../asof` Relevance

`../asof` is highly relevant conceptually.

AsOf's core mental model:

- Immutable execution/event log.
- State derived "as of" any cursor.
- Inspector for event payloads.
- Time-travel and ghosting future events.
- Fork and diff.
- Agent/skill lineage.
- Searchable archive.

This maps almost perfectly to trusted learning graph creation:

- A source ingestion run is an execution.
- Transcript chunks, model calls, structured extraction, validation errors, user edits, and publish events are event nodes.
- A learning graph is derived state as of a cursor.
- Forking lets the user compare "extract with GPT-5.2" vs "extract with Gemini video understanding" vs "human edited."
- Diff shows what changed in the atom graph, not just text.
- The inspector can answer: "Where did this atom come from? Which prompt made it? Which source timestamp supports it? Who reviewed it?"

Recommended relationship:

- Do not merge the products immediately.
- Reuse AsOf architecture patterns and possibly its Go + SQLite + OpenAPI + Pixi/d3 graph stack.
- Consider a shared package for event log, graph render primitives, source anchors, and derivation inspection.
- Systems/Models becomes the semantic learning layer; AsOf becomes the lineage/debugging substrate.

## Product Definition

Working product name:

> Systems & Models Studio

Sharper category:

> Source-grounded AI learning graph editor.

Primary user:

- Serious self-learners, educators, course creators, technical writers, and expert communities who want to turn source material into trusted learning paths.

Initial wedge:

- Convert a YouTube video, podcast episode, paper, or article into a reviewed learning graph.

Core promise:

- "Learn from AI, but never lose the thread back to the source."

## The Learning Graph Object Model

Do not make "system", "model", and "provenance" separate database islands. Make all primary objects atoms with typed roles.

Core objects:

```yaml
SourceAsset:
  id: string
  uri: string
  media_type: video | audio | pdf | html | markdown | text
  title: string
  creator: string
  license: string
  content_hash: string
  c2pa_manifest: optional

SourceAnchor:
  id: string
  source_asset_id: string
  selector:
    kind: text_quote | char_range | timestamp_range | page_range | frame_range
    start: string
    end: string
  excerpt: string

Atom:
  id: string
  kind: system | model | claim | example | exercise | misconception | term | provenance
  title: string
  summary: string
  body: markdown
  learning_level: intro | working | advanced
  review_state: generated | edited | reviewed | rejected | published
  source_anchor_ids: string[]

Relationship:
  id: string
  from_atom_id: string
  to_atom_id: string
  predicate: uses | explains | requires | supports | contradicts | evidences | assesses | remediates | example_of
  review_state: generated | reviewed | rejected
  source_anchor_ids: string[]

DerivationRun:
  id: string
  source_asset_ids: string[]
  model_provider: string
  model_name: string
  model_snapshot: string
  prompt_hash: string
  schema_version: string
  created_at: string
  output_atom_ids: string[]
  validation_results: object

LearningPack:
  id: string
  title: string
  version: string
  license: string
  atoms: Atom[]
  relationships: Relationship[]
  sources: SourceAsset[]
  derivations: DerivationRun[]
```

Systems and models remain the product language:

- A system atom always has executable steps, prerequisites, and success criteria.
- A model atom always explains a concept, mechanism, theory, or frame.
- A claim atom is a smaller unit that can be supported, contradicted, or revised.
- An exercise atom turns knowledge into retrieval, application, or assessment.

This resolves the old fuzziness. "Guru as a model" and "evaluating guru as a system" can both exist:

- Model: what a guru is, what authority means, what failure modes exist.
- System: how to evaluate whether someone should be your guru.
- Claims: concrete assertions about a particular guru.
- Provenance: quotes, actions, outcomes, historical evidence.
- Exercises: prompts/checks to test whether the learner can apply the evaluation system.

## Editor Experience

The editor should feel closer to a research IDE than a notes app.

Recommended layout:

1. Source pane
   - Transcript, video, audio, PDF, or article.
   - Timestamp/page anchors.
   - Highlight text and create atoms from selection.
   - Jump from atom to exact source.

2. Atom outline
   - Hierarchical list of proposed atoms grouped by topic, learning path, or source section.
   - Review queue: unsupported claims, weak anchors, duplicate atoms, missing prerequisites.

3. Graph canvas
   - Local subgraph around selection, not a full hairball.
   - Systems, models, claims, exercises, provenance, and source anchors have distinct shapes.
   - Edge editing is direct and fast.
   - Semantic zoom shows titles far out, details close in.

4. Inspector
   - Source anchors.
   - Derivation run.
   - Model/prompt/schema version.
   - Review state.
   - Relationship evidence.
   - Diff from previous version.

5. Tutor/test panel
   - Generate retrieval questions.
   - Ask "teach me this path."
   - Socratic mode constrained to reviewed atoms.
   - "Show source" and "why should I believe this?" always visible.

Nice interactions:

- "Find unsupported claims."
- "Suggest missing prerequisites."
- "Show all atoms derived from 12:30-18:00."
- "Compare extraction runs."
- "Promote reviewed atoms to pack."
- "Generate an exercise for this model."
- "What systems use this model?"
- "What would change if this provenance is rejected?"

## Ingestion Pipeline

For YouTube/podcasts/videos:

1. Create `SourceAsset` with URL, title, creator, license/rights metadata, hash where possible.
2. Get transcript:
   - Native transcript if available.
   - Audio transcription fallback.
   - Speaker diarization for podcasts/interviews where speaker identity matters.
3. For video, optionally run multimodal analysis:
   - Slides, diagrams, screen recordings, demonstrations, visual examples.
   - Timestamped anchors.
4. Segment into learning-relevant chunks.
5. Extract candidate atoms with structured outputs.
6. Extract candidate edges.
7. Validate:
   - Every atom has at least one anchor.
   - Every `proven` or `published` atom has review state.
   - Every system has steps.
   - Every model has explanation and boundaries.
   - Every exercise has an answer/check or rubric.
8. Human review.
9. Publish/export learning pack.

Recommended model routing:

- Cheap/fast model for transcript cleanup and segmentation.
- Strong reasoning model for atom and edge extraction.
- Video-native model for multimodal source analysis.
- Embedding model for semantic similarity, duplicate detection, and search.
- Optional local/open-weight models for private/offline extraction when quality permits.

Important: source anchors must be stored before generated summaries. The graph should always be able to show the original passage/timestamp.

## Search And Discovery

Search should be hybrid:

- FTS/BM25 for exact terms, titles, quotes, names.
- Embeddings for semantic similarity.
- Graph traversal for "related because it requires/explains/supports."
- Filters for source, creator, review state, license, learning level, atom kind.

Search results should explain why they match:

- Text match in title/body/source.
- Semantic similarity to atom.
- Graph neighbor of selected atom.
- Shared source anchor or derivation.

This is where the "lingua franca" value appears: a portable graph format makes source-grounded learning content searchable across providers and tools.

## Package And Marketplace Strategy

Build packages first, marketplace later.

Package format requirements:

- Stable IDs.
- Versioned schema.
- Manifest.
- Sources and anchors.
- Atoms and relationships.
- Review states.
- Derivation logs.
- License and rights metadata.
- Optional embeddings/cache.
- Optional JSON-LD export.
- Optional signature.

Marketplace should not launch until:

- Packs are useful outside a marketplace.
- Import/export is stable.
- There is a curator/reviewer workflow.
- Licensing is solved for source-derived material.
- Quality signals exist.

First commercial wedge:

- Curated, high-quality packs for specific domains, for example "Learning AI Agents from 20 talks", "Modern nutrition evidence map", "Foundations of reinforcement learning", or "How to evaluate gurus."

Marketplace quality signals:

- Source coverage.
- Review completeness.
- Citation density.
- Contradiction handling.
- Update recency.
- Learner outcomes.
- Creator/reviewer reputation.
- License clarity.

## Technical Architecture Recommendation

### Near-Term

Use a local-first desktop/web hybrid rather than pure browser-only.

Recommended stack:

- Core store: SQLite with migrations, FTS5, JSON columns.
- Vector search: sqlite-vec, LanceDB, or a separate local vector index.
- Backend/runtime: Go + SQLite is attractive because `../asof` already proves that path.
- Frontend: React/Next or Vite, but with a canonical typed API/schema boundary.
- Graph renderer:
  - React Flow for editable local relationship diagrams, or
  - Pixi/d3 from AsOf for high-performance large graph browsing.
- Validation: JSON Schema plus graph-specific constraints.
- AI providers: provider abstraction with logged model snapshot, prompt hash, schema version, cost/tokens, and output.

### Why Not Just Continue The Browser App?

The browser app is good for a demo, but ingestion wants:

- Local file access.
- Larger media handling.
- Background jobs.
- Model call logs.
- Caches.
- Real SQLite migrations.
- FTS/vector indexes.
- A durable package/export pipeline.

The browser app can be either:

- archived as the v0 spike, or
- refactored into the editor UI on top of a new core.

Do not let it define the domain model.

## Roadmap

### Phase 0: Canonical Schema And Repair

Goal: one truth for atoms, sources, anchors, relationships, packs, derivations.

Tasks:

- Write `schema/learning-pack.schema.json`.
- Write TypeScript types generated from the schema.
- Preserve imported IDs.
- Add validators and fixture tests.
- Fix current TypeScript build or freeze the app and start a new package.

Exit criteria:

- A sample learning pack validates.
- IDs remain stable across import/export.
- Every atom can link to source anchors.

### Phase 1: Source-To-Pack CLI

Goal: turn one source into a draft pack.

Tasks:

- `ingest youtube <url>` or `ingest transcript <file>`.
- Store transcript/source anchors.
- Extract atoms via structured output.
- Validate and write `*.learning-pack.json`.
- Log derivation run.

Exit criteria:

- One YouTube video produces a reviewable draft pack.
- Every generated atom links back to timestamps or quotes.

### Phase 2: Review Editor

Goal: make humans fast at correcting AI proposals.

Tasks:

- Source pane with highlights/timestamps.
- Atom outline and review queue.
- Local subgraph editor.
- Inspector with provenance and derivation.
- Diff generated vs edited.

Exit criteria:

- A user can review a generated pack without opening raw JSON.
- Rejected/generated/reviewed states are clear.

### Phase 3: Learning Mode

Goal: prove learning utility.

Tasks:

- Tutor constrained to reviewed atoms.
- Retrieval practice generation.
- Misconception checks.
- Prerequisite path navigation.
- "Show source" on all explanations.

Exit criteria:

- A learner can use a reviewed pack to study a topic.
- The app avoids answer-engine behavior by default.

### Phase 4: Pack Distribution

Goal: validate lingua franca before marketplace.

Tasks:

- Pack import/export.
- Public pack gallery or Git repo.
- Package versioning and diffs.
- License metadata.
- Curated first-party packs.

Exit criteria:

- Third parties can create/import packs.
- Search works across multiple packs.

### Phase 5: Marketplace

Only after distribution proves demand.

Tasks:

- Creator identity.
- Reviewer identity.
- Payments.
- Reviews/ratings.
- Pack dependencies.
- Versioned updates.
- Rights enforcement.

## Key Risks

### Copyright And Source Rights

YouTube and podcasts are not automatically marketplace-safe. For personal learning, storing anchors and short excerpts may be acceptable depending on jurisdiction and terms. For paid packs, use licensed/creator-authorized content or store references rather than redistributed transcripts.

Recommendation: marketplace terms and pack manifest must include source rights and excerpt policy from day one, even if commerce waits.

### Hallucinated Structure

AI will invent too-clean models and causal edges.

Recommendation: no atom or edge becomes published unless it has anchors and review state. Use validation to make unsupported claims visible.

### Graph Hairball

Global graphs impress in demos and collapse in use.

Recommendation: default to local neighborhoods, learning paths, outlines, and source sections. Use global graph as a map, not the workspace.

### Standards Overload

RDF/PROV/C2PA/Open Badges are valuable, but starting there can bury the product.

Recommendation: internal JSON first, standards mappings second.

### Marketplace Premature Optimization

Marketplaces fail without supply, demand, trust, quality, and rights.

Recommendation: start with packs and curated distribution. Marketplace is a scaling pattern, not the product.

## Recommended Next Move

Make a hard reset around a single demo:

> Import one high-quality YouTube lecture or podcast episode and produce a reviewed learning pack with source-anchored systems, models, claims, exercises, and relationships.

The demo should show:

1. Source video/transcript.
2. Generated atom proposals.
3. Human review.
4. Graph relationships.
5. Source-backed tutor mode.
6. Exported portable pack.
7. As-of lineage for the extraction and edits.

That will answer the real question: can this turn AI learning from "ask a chatbot" into "build and share trusted learning structures"?

My recommendation is yes, with one caveat: the product lives or dies by the editor and trust workflow, not by the graph visualization alone.

