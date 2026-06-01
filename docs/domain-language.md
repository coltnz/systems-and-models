# Domain Language

> Turn sources into knowledge.
> Grounded, teachable, malleable.

This is the naming source of truth for Systems & Models concepts. Use
these terms in docs, issues, UI copy, code comments, and review notes
when they describe the same idea.

The boundary matters: concepts are things learners, authors, reviewers,
or maintainers need to reason about. Implementation patterns are allowed
in architecture docs, but should not become product-facing nouns unless
they are exposed in UI, imports, exports, database schema, package
contracts, logs, or public APIs.

## Naming Rules

- Use `System` for an actionable process, workflow, protocol, or
  repeatable method. A system should contain steps or decision rules.
- Use `Model` for an explanatory concept, framework, principle, or
  mental model. A model should help the learner understand, predict, or
  frame something.
- Use `Provenance` for why a system or model should be trusted. It is
  evidence, source material, theory, research, fact, quote, principle, or
  corollary.
- Use `Relationship` for an explicit typed edge between entities. Do not
  use tags as a substitute for graph structure.
- Use `Learning Graph` for the connected body of systems, models,
  provenance, and relationships. Use `Knowledge Graph` when discussing
  the current implementation or generic graph tooling.
- Use `Learning Pack` for a portable, versioned package of sources,
  anchors, atoms, relationships, and derivation metadata. Do not call a
  raw YAML seed file a learning pack unless it satisfies that contract.
- Keep current and future terms distinct. The current app has separate
  `systems`, `models`, and `provenance` tables; future architecture may
  unify them as typed `Atom` records.

## Core Product Concepts

| Concept | Definition | Implementation note |
|---|---|---|
| Systems & Models | Local-first knowledge tool for capturing what to do, what to know, and why to trust it. | Current app lives in `app/`; strategy and architecture notes live under `docs/`. |
| System | Actionable process, methodology, workflow, habit, protocol, or checklist. | Stored in `systems`; status is `draft`, `active`, `archived`, or `proven`. |
| Model | Explanatory concept, framework, principle, or mental model. | Stored in `models`; type is `mental-model`, `concept`, `framework`, or `principle`. |
| Provenance | Evidence and source-backed justification for a system or model. | Stored in `provenance`; type is `theory`, `quote`, `fact`, `principle`, `corollary`, or `research`. |
| Relationship | Directed, typed connection between two entities. | Stored in `relationships` with `from_type`, `from_id`, `to_type`, `to_id`, `relationship_type`, optional `strength`, `metadata`, and tags. |
| Learning Graph | Reviewable graph of practical knowledge, explanatory models, evidence, and learning artifacts. | Product concept; current UI renders a knowledge graph with Cytoscape. |
| Knowledge Graph | Generic graph representation of entities and relationships. | Acceptable when describing storage, graph rendering, or import schema. |
| Learning Pack | Portable package for reviewed learning content. | Future contract should include stable IDs, sources, anchors, atoms, relationships, review states, derivation runs, schema version, and license metadata. |
| Source-Grounded Learning | Learning experience where every important claim can point back to source material. | Product direction; source anchors are the trust primitive. |

## Entity Concepts

| Concept | Definition | Implementation note |
|---|---|---|
| Entity | Current persisted object that can appear as a node. | Current entity types are `system`, `model`, and `provenance`. |
| Stable ID | Durable identifier used for imports, relationships, and permalinks. | Current generated IDs are timestamp-based; schema docs say published IDs should not change. |
| Permalink | Shareable hash URL for one entity. | Format is `#/system/{id}`, `#/model/{id}`, or `#/provenance/{id}`. |
| Tag | Lightweight categorization label. | Tags support filtering/search; they do not express evidence or prerequisites. |
| Evidence Link | Legacy/current system field that points to provenance IDs. | Prefer explicit `Relationship` edges for new graph semantics. |
| Status | Lifecycle state for a system. | `draft` means unproven or incomplete; `proven` should imply supporting provenance, not just confidence. |
| Model Type | Category for a model. | Use the exact enum values: `mental-model`, `concept`, `framework`, `principle`. |
| Provenance Type | Category for source/evidence material. | Use the exact enum values: `theory`, `quote`, `fact`, `principle`, `corollary`, `research`. |
| Credibility Score | Numeric source reliability hint. | Current field is `credibility_score`; future architecture should favor review completeness and provenance quality over a subjective score alone. |
| Evolution Note | Human note explaining why understanding changed. | Table exists as `evolution_notes`; use for rationale, not immutable change history. |
| Event | Immutable record of an entity change. | Stored in `events` with `entity_type`, `entity_id`, `event_type`, JSON data, metadata, and timestamp. |

## Relationship Concepts

| Concept | Definition | Implementation note |
|---|---|---|
| Relationship Predicate | Controlled verb that names how two entities connect. | Current field is `relationship_type`; import YAML calls this `type`. |
| Uses | Source entity applies or depends on the target. | Typical shape: `System uses Model`. |
| Explains | Source entity clarifies or makes sense of the target. | Typical shape: `Model explains System` or `Model explains Model`. |
| Requires | Source entity needs the target as a prerequisite. | Use for prerequisite systems, models, or evidence requirements. |
| Extends | Source entity builds on or specializes the target. | Use for refinements and derived frameworks. |
| Contradicts | Source entity conflicts with the target. | Use explicitly; do not hide contradictions in prose. |
| Supports | Source entity reinforces the target without being the primary proof. | Use when evidence is helpful but not decisive. |
| Evidences | Source entity provides direct justification for the target. | Typical shape: `Provenance evidences Model` or `Provenance evidences System`. |
| Strength | Optional weighting convention for a relationship, usually authored on a 0-100 scale. | Use as an authoring hint, not as an automated truth score; the current database stores it as an unconstrained integer. |

## Source And Learning Concepts

These terms describe the recommended next architecture. Use them when
talking about source ingestion, review workflows, package formats, or
future schema design.

| Concept | Definition | Implementation note |
|---|---|---|
| Source Asset | Original material used to create or verify learning content. | Examples: video, podcast, paper, article, transcript, conversation, or course notes. |
| Source Anchor | Exact location inside a source asset. | Examples: timestamp range, page range, quote selector, frame range, or character range. |
| Atom | Unified future object for a system, model, claim, example, exercise, misconception, term, or provenance item. | Keep `Atom` to schema/architecture discussions until the app actually stores atoms. |
| Claim | Small assertion that can be supported, contradicted, or revised. | Useful for source extraction; do not force all claims into `Model`. |
| Exercise | Learning artifact that asks the learner to retrieve, apply, or test knowledge. | Future atom kind; should include an answer, check, or rubric. |
| Misconception | Common wrong belief or failure mode that learning content should remediate. | Future atom kind; often linked by `contradicts` or `remediates` in later schemas. |
| Review State | Human/editorial state of an atom or relationship. | Recommended values include `generated`, `edited`, `reviewed`, `rejected`, and `published`. |
| Derivation Run | Logged AI or tool execution that produced graph proposals from sources. | Should record provider, model, snapshot, prompt hash, schema version, inputs, outputs, validation, cost, and timestamp. |
| Source-To-Pack Ingestion | Pipeline that turns source material into draft learning graph content. | Steps: ingest source, segment, extract atoms, extract edges, validate, review, publish/export. |
| Tutor Mode | Learning experience constrained to reviewed atoms and source anchors. | Should keep "show source" and "why should I believe this?" available. |

## UI Concepts

| Concept | Definition | Implementation note |
|---|---|---|
| List View | Main browsing surface for systems, models, and provenance cards. | Current page: `Home`; supports search and creation dialogs. |
| Graph View | Visual network surface for nodes and relationship edges. | Current page: `Graph`; implemented with Cytoscape. |
| Detail View | Entity-focused reading surface with permalink, markdown body, evidence, and relationships. | Current page: `Detail`; route is hash/permalink-driven. |
| Card | Compact representation of one entity in list view. | Product copy should identify entity type, title, description, tags, and lifecycle/type metadata. |
| Link Dialog | UI for creating a typed relationship from one entity to another. | Component: `LinkEntityDialog`. |
| Import Dialog | UI for importing YAML graph data. | Component: `ImportDataDialog`; imports current schema, not full learning packs. |
| Search | Keyword search over titles, descriptions, content, tags, status/type, and provenance source. | Current search is client-side scoring in `searchEntities`. |
| Graph Node | Visual representation of an entity. | Current colors: systems blue, models purple, provenance amber. |
| Graph Edge | Visual representation of a relationship. | Edge labels show predicate and optional tags. |
| Semantic Zoom | Graph behavior where label detail changes with zoom level. | Implemented in `graph-styles`; use for graph UI, not data model language. |
| Inspector | Future side panel for source anchors, derivation runs, validation, review state, and diffs. | Current detail sidebar is a graph selection panel, not yet a full inspector. |

## Data And Platform Concepts

| Concept | Definition | Implementation note |
|---|---|---|
| Browser Database | SQLite database running in the browser through `sql.js`. | Current implementation loads sql.js WASM from `https://sql.js.org/dist/`. |
| IndexedDB Persistence | Browser storage for the exported SQLite database bytes. | Current database name is `SystemsAndModelsDB`; object store is `database`. |
| YAML Knowledge Base | Import format for seeding systems, models, provenance, and relationships. | Documented in `data/schema.md`; current import generates new internal IDs. |
| Schema Version | Version marker for import/export contracts. | Current YAML includes `version`; future learning packs need a stricter schema version. |
| Local-First | Product principle that user data should remain usable and owned locally. | Do not equate local-first with "browser-only"; future ingestion likely needs a desktop or local backend. |
| Event Sourcing | Pattern where changes are recorded as immutable events and state can be inspected over time. | Current implementation records events but does not yet expose full as-of reconstruction in UI. |
| As-Of State | Derived state at a specific event cursor. | Future architecture pattern borrowed from adjacent as-of work; not implemented in the current app. |
| Package Manifest | Metadata for a portable learning pack. | Should include title, version, schema version, license, source rights, hashes, and optional signatures. |
| Marketplace | Distribution and commerce surface for learning packs. | Future scaling pattern; do not treat it as the product itself. |

## Implementation Patterns

| Pattern | Use | Keep it scoped |
|---|---|---|
| Three-Layer Knowledge Model | Systems are what to do; models are what to know; provenance is why to trust it. | This is the product vocabulary users should learn first. |
| First-Class Provenance | Evidence is modeled as graph content, not only as links in markdown. | Use when explaining trust, review, and source-backed learning. |
| Explicit Relationship Edge | Typed graph edge captures meaning between entities. | Use instead of relying on proximity, tags, or prose-only references. |
| Event Log With Snapshot Data | Entity CRUD records JSON snapshots in `events`. | Use for history/audit discussions; future as-of support needs stronger invariants. |
| Graph Projection | UI maps database rows into Cytoscape nodes and edges. | Use for rendering discussions; it is not the canonical package model. |
| Source Anchor First | Source locations should be stored before generated summaries. | Use for ingestion and trust workflows. |
| AI Output As Proposal | Generated graph content requires validation and human review before publication. | Use for model-assisted extraction; never imply generated means trusted. |
| Portable Package Contract | Learning content should move between tools as a versioned package. | Use for import/export and future marketplace planning. |
| Local Subgraph Editing | Show the relevant neighborhood around a selected item. | Prefer this over global graph hairball workflows for real editing. |

## Boundary Notes

- `System` and `Model` are distinct by job, not by topic. If it tells
  someone what steps to take, it is a system. If it explains how to
  understand something, it is a model.
- `Provenance` is not just a URL. It is the structured reason to trust a
  system, model, claim, or relationship.
- `Source Asset` is the original work. `Source Anchor` is the exact
  location inside that work. `Provenance` is the evidence object in the
  learning graph.
- `Evidence Link` is a current field on systems. Prefer explicit
  relationship edges when modeling evidence in the graph.
- `Relationship` is not a tag. Tags classify; relationships explain.
- `Event` is not an evolution note. Events record what changed;
  evolution notes explain why understanding changed.
- `Credibility Score` is not review state. A source can be credible while
  a generated interpretation remains unreviewed.
- `Knowledge Graph` is not automatically a `Learning Pack`. A learning
  pack needs source rights, anchors, schema version, review state, and a
  portable manifest.
- `Local-first` is not the same as current browser-only storage. The
  product can remain local-first while moving ingestion, search, or
  package validation into a local backend.
- The current split tables are implementation detail. Future architecture
  may unify systems, models, claims, exercises, and provenance as typed
  atoms while preserving the user-facing language.
