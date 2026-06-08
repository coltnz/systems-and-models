/**
 * @sam/types — the shared type layer for the LearningPack v0 contract.
 *
 * These TypeScript types mirror `spec/learning-pack.schema.json` (the single
 * source of truth, D-005). This package is types-only: no runtime logic beyond
 * the `SCHEMA_VERSION` constant. The validator (bd-4) enforces the schema at
 * runtime; these types give the rest of the workspace compile-time shape.
 *
 * When the schema changes, change it here too — they must stay in lockstep.
 */

/** schema_version const in the pack contract. Matches the schema's `const: "0"`. */
export const SCHEMA_VERSION = '0' as const
export type SchemaVersion = typeof SCHEMA_VERSION

// --- Shared scalars ---------------------------------------------------------

/** Non-empty string id (`$defs/id`). Branding is deferred; plain string for v0. */
export type Id = string

// --- Unions / enums ---------------------------------------------------------

/** `$defs/reviewState` — lifecycle of an atom or relationship. */
export type ReviewState =
  | 'generated'
  | 'edited'
  | 'reviewed'
  | 'rejected'
  | 'published'

/**
 * `$defs/supportState` — reviewed judgment that an anchored excerpt actually
 * supports the claim. `verifiable` is necessary but not sufficient; this is the
 * human trust call.
 */
export type SupportState =
  | 'supports'
  | 'partially'
  | 'does_not_support'
  | 'disputed'

/** SourceAsset.media_type */
export type MediaType = 'video' | 'audio' | 'pdf' | 'html' | 'markdown' | 'text'

/** SourceAsset.access */
export type Access = 'owned' | 'open' | 'restricted'

/** Selector.kind */
export type SelectorKind = 'text_quote' | 'timestamp_range' | 'page_range'

/** SourceAnchor.extraction_method */
export type ExtractionMethod = 'asr' | 'native' | 'ocr' | 'human'

/** Atom.kind — probe-minimum kinds only (D: exercise/term/example deferred). */
export type AtomKind = 'system' | 'model' | 'claim'

/** Authorship of an atom. */
export type AuthoredBy = 'ai' | 'human' | 'mixed'

/** Relationship.predicate — first-class edge semantics. */
export type Predicate = 'uses' | 'requires' | 'explains' | 'supports' | 'contradicts'

/** DerivationRun.op — the operation that produced/changed records. */
export type DerivationOp = 'ingest' | 'extract' | 'edit' | 'publish'

/** DerivationRun.actor */
export type DerivationActor = 'ai' | 'human'

// --- Source layer -----------------------------------------------------------

/** `$defs/SourceAsset` — a stored source (video/pdf/html/...). */
export interface SourceAsset {
  id: Id
  uri: string
  media_type: MediaType
  title: string
  creator?: string
  /** e.g. CC-BY-4.0, or 'creator-authorized'. */
  license: string
  access: Access
  content_hash?: string
}

/** Selector inside a SourceAnchor (`SourceAnchor.selector`). */
export interface Selector {
  kind: SelectorKind
  /** char offset, ms, or page as string. */
  start: string
  end: string
}

/** `$defs/SourceAnchor` — a verifiable span into a source asset. */
export interface SourceAnchor {
  id: Id
  source_asset_id: Id
  selector: Selector
  /** The exact supporting text/caption, stored inline. */
  excerpt: string
  extraction_method: ExtractionMethod
  /** COMPUTED: excerpt re-derives from selector against the stored source. */
  verifiable: boolean
}

// --- Atom layer -------------------------------------------------------------

/** An ordered step inside a `system` atom (`Atom.steps[]`). */
export interface Step {
  text: string
}

/** Reference from an atom to a source anchor plus its reviewed support call. */
export interface AtomAnchorRef {
  anchor_id: Id
  support_state: SupportState
}

/** `$defs/Atom` — a unit of learning content (system / model / claim). */
export interface Atom {
  id: Id
  kind: AtomKind
  title: string
  summary?: string
  /** markdown */
  body?: string
  /** systems only; ordered steps. */
  steps?: Step[]
  review_state: ReviewState
  authored_by: AuthoredBy
  anchors: AtomAnchorRef[]
  derivation_id: Id
  /** integer >= 1 */
  version: number
}

// --- Relationship layer -----------------------------------------------------

/**
 * `$defs/Relationship` — a first-class, reviewable edge between atoms.
 *
 * The schema's `dependentRequired` ({ anchor_ids: ["support_state"] }) means: if
 * `anchor_ids` is present, `support_state` is required. We express that as a
 * discriminated union so the type system enforces the same invariant.
 */
export type Relationship = RelationshipBase &
  (RelationshipWithAnchors | RelationshipWithoutAnchors)

interface RelationshipBase {
  id: Id
  from_atom_id: Id
  to_atom_id: Id
  predicate: Predicate
  review_state: ReviewState
}

interface RelationshipWithAnchors {
  /** Source spans where the source itself asserts this relation. */
  anchor_ids: Id[]
  /** Required when anchor_ids is set (dependentRequired in the schema). */
  support_state: SupportState
}

interface RelationshipWithoutAnchors {
  anchor_ids?: undefined
  support_state?: SupportState
}

// --- Provenance / cost ------------------------------------------------------

/** `DerivationRun.cost` — logged so the probe can answer usd_per_published_atom. */
export interface Cost {
  /** integer >= 0 */
  tokens_in?: number
  /** integer >= 0 */
  tokens_out?: number
  /** number >= 0 */
  usd?: number
}

/** `$defs/DerivationRun` — provenance for an ingest/extract/edit/publish op. */
export interface DerivationRun {
  id: Id
  op: DerivationOp
  input_ids?: Id[]
  output_ids?: Id[]
  actor: DerivationActor
  model_name?: string
  model_snapshot?: string
  prompt_hash?: string
  schema_version: string
  cost?: Cost
  /** ISO 8601 date-time string. */
  created_at: string
}

// --- Eval -------------------------------------------------------------------

/** Accept/edit/reject tallies from review. */
export interface AcceptEditReject {
  accept?: number
  edit?: number
  reject?: number
}

/** Gold-set provenance for the eval. */
export interface GoldSet {
  /** integer >= 1 */
  annotators?: number
  /** 0..1 inter-rater agreement on the double-annotated subset. */
  inter_rater_agreement?: number
}

/** What the probe compared against (e.g. NotebookLM, naive single-prompt). */
export interface Baseline {
  name?: string
  notes?: string
}

/** `$defs/Eval` — probe results. All numeric fields are 0..1 unless noted. */
export interface Eval {
  anchor_precision?: number
  claim_support_accuracy?: number
  relationship_precision?: number
  extraction_precision?: number
  extraction_recall?: number
  grounding_accuracy?: number
  refusal_correctness?: number
  /** number >= 0 */
  median_minutes_per_published_atom?: number
  /** number >= 0 */
  usd_per_published_atom?: number
  accept_edit_reject?: AcceptEditReject
  gold_set?: GoldSet
  baseline?: Baseline
}

// --- Top-level pack ---------------------------------------------------------

/** `LearningPack v0` — the root document. */
export interface LearningPack {
  id: Id
  title: string
  version: string
  schema_version: SchemaVersion
  license: string
  /** minItems: 1 in the schema. */
  sources: SourceAsset[]
  anchors: SourceAnchor[]
  atoms: Atom[]
  relationships: Relationship[]
  derivations: DerivationRun[]
  eval?: Eval
}
