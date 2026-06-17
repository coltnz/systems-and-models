/**
 * Shared DRAFT-assembly helpers used by both adapters.
 *
 * Centralizes the "draft semantics" (bd-6) so the mock and OpenAI adapters
 * produce structurally identical drafts: atoms with `review_state="generated"`,
 * `authored_by="ai"`, `version=1`; anchor refs constrained to the input anchor
 * ids; relationships with `review_state="generated"` (and, if anchored, a
 * required `support_state`); and an `extract` DerivationRun whose `output_ids`
 * are the produced atom + relationship ids.
 *
 * Nothing here touches the network, the clock (except via an injected value),
 * or randomness — it is a pure function of its inputs.
 */
import type {
  Atom,
  AtomAnchorRef,
  AtomKind,
  Cost,
  DerivationRun,
  Predicate,
  Relationship,
  SupportState,
} from '@sam/types'

/**
 * A provider-neutral DRAFT atom: the subset of fields an adapter decides, with
 * the lifecycle fields (`review_state`/`authored_by`/`version`/`derivation_id`)
 * filled in centrally. Anchor refs are validated against the input anchors
 * before assembly.
 */
export interface DraftAtom {
  id: string
  kind: AtomKind
  title: string
  summary?: string
  body?: string
  /** Anchor refs. Each `anchor_id` MUST be one of the input anchor ids. */
  anchors: AtomAnchorRef[]
}

/**
 * A provider-neutral DRAFT relationship. If `anchor_ids` is set, `support_state`
 * is required and the ids must be input anchor ids (enforced in assembly).
 */
export interface DraftRelationship {
  id: string
  from_atom_id: string
  to_atom_id: string
  predicate: Predicate
  anchor_ids?: string[]
  support_state?: SupportState
}

/** Everything an adapter produces, before lifecycle/provenance is stamped on. */
export interface DraftBundle {
  atoms: DraftAtom[]
  relationships: DraftRelationship[]
}

export interface AssembleArgs {
  sourceAssetId: string
  /** Deterministic id for the extract derivation (NOT time-based). */
  derivationId: string
  /** The exact set of anchor ids the draft may reference (from input.anchors). */
  validAnchorIds: ReadonlySet<string>
  draft: DraftBundle
  cost: Cost
  /** tz-aware ISO instant for the derivation (injected clock). */
  createdAt: string
  /** Optional provenance for the OpenAI path. */
  derivationExtras?: {
    model_name?: string
    model_snapshot?: string
    prompt_hash?: string
  }
}

/** Raised when a draft references an anchor id not present in `input.anchors`. */
export class UnknownAnchorError extends Error {
  constructor(anchorId: string, where: string) {
    super(
      `extraction draft references anchor_id "${anchorId}" (${where}) that is ` +
        `not present in input.anchors — extraction must not invent anchors (bd-5 owns anchors).`,
    )
    this.name = 'UnknownAnchorError'
  }
}

/**
 * Assemble a validated {@link DraftBundle} into final atoms/relationships + an
 * `extract` DerivationRun. Throws {@link UnknownAnchorError} if any referenced
 * anchor id is not in `validAnchorIds`, so a buggy adapter (or a hallucinated
 * model output) can never smuggle in a fabricated anchor.
 *
 * It is also the authoritative chokepoint for graph-integrity, so a draft from
 * ANY adapter is always free of graph errors (bd-12, bd-13, bd-15). Concretely it:
 *   - DROPS any atom or relationship whose `id` is already taken pack-wide
 *     (keep-FIRST dedupe). "Taken" is tracked in a single `used` set seeded with
 *     the RESERVED ids — `sourceAssetId`, `derivationId`, and every input anchor
 *     id — plus every atom/relationship id kept so far. This subsumes the old
 *     per-collection dedupe and additionally guarantees extraction never emits a
 *     globally-colliding id, so the validator's `cross_collection_duplicate_id`
 *     check can never strand an extraction draft (D-013). We drop rather than
 *     rename because a relationship endpoint may reference a duplicated atom id:
 *     dropping keeps the FIRST definition intact so that reference still resolves,
 *     whereas renaming would silently break it (bd-13),
 *   - DROPS any relationship whose `from_atom_id`/`to_atom_id` is not an atom
 *     produced in this same draft (a dangling endpoint can't be repaired through
 *     the review UI, so it would otherwise block reviewed-save forever), and
 *   - NORMALIZES a present-but-empty `anchor_ids` to a no-anchor relationship
 *     (omitting both `anchor_ids` and `support_state`).
 * A NON-empty `anchor_ids` referencing an unknown anchor still throws
 * {@link UnknownAnchorError} (the "never invent anchors" hard guarantee).
 */
export function assembleExtraction(args: AssembleArgs): {
  atoms: Atom[]
  relationships: Relationship[]
  derivation: DerivationRun
} {
  const { validAnchorIds } = args

  // Pack-global id uniqueness chokepoint (bd-15 / D-013). `used` is the set of
  // ids already taken pack-wide. It is SEEDED with the RESERVED ids extraction
  // does not own — the source asset, this extract derivation, and every input
  // anchor id — so a model can never emit an atom/relationship whose id collides
  // with one of them (which the validator's new `cross_collection_duplicate_id`
  // check would otherwise strand on the persisted draft). This single set also
  // subsumes the old per-collection `seenAtomIds`/`seenRelIds` dedupe: any atom
  // OR relationship whose id is already in `used` is dropped (keep-FIRST).
  const used = new Set<string>([
    args.sourceAssetId,
    args.derivationId,
    ...validAnchorIds,
  ])

  // KEPT atom ids only — a SEPARATE set from `used`, because a relationship
  // endpoint must point at an atom actually produced in this draft, NOT merely
  // at some reserved/used id (a reserved id is not an atom). The dangling-endpoint
  // check below reads `atomIds`, never `used` (bd-15).
  const atomIds = new Set<string>()

  // DROP id-colliding atoms (keep-FIRST, preserve order): a model may emit two
  // atoms with the same id (the validator would flag `duplicate_id`) or an atom
  // whose id collides with a reserved id (cross-collection collision). We drop
  // the later one rather than rename it because a relationship endpoint may
  // reference this id — keeping the FIRST definition means that reference still
  // resolves, whereas renaming would silently break it (bd-13).
  const atoms: Atom[] = args.draft.atoms.flatMap((d) => {
    if (used.has(d.id)) {
      return []
    }
    used.add(d.id)
    atomIds.add(d.id)
    for (const ref of d.anchors) {
      if (!validAnchorIds.has(ref.anchor_id)) {
        throw new UnknownAnchorError(ref.anchor_id, `atom "${d.id}"`)
      }
    }
    const atom: Atom = {
      id: d.id,
      kind: d.kind,
      title: d.title,
      ...(d.summary !== undefined ? { summary: d.summary } : {}),
      ...(d.body !== undefined ? { body: d.body } : {}),
      review_state: 'generated',
      authored_by: 'ai',
      anchors: d.anchors,
      derivation_id: args.derivationId,
      version: 1,
    }
    return [atom]
  })

  const relationships: Relationship[] = args.draft.relationships.flatMap((d) => {
    // DROP id-colliding relationships (keep-FIRST, preserve order): a model may
    // emit two relationships with the same id (the validator would flag
    // `duplicate_id`), or a relationship whose id collides with a reserved id or
    // a kept atom id (cross-collection collision). We drop the later one (keep
    // first) — same rationale as atoms above. Checked FIRST so a kept edge is
    // unique-id AND (below) has valid endpoints AND normalized anchors (bd-13).
    if (used.has(d.id)) {
      return []
    }
    used.add(d.id)

    // DROP dangling-endpoint edges: an edge to an atom not produced in THIS draft
    // can't be repaired through the review UI, so it would block reviewed-save
    // forever. Tested against `atomIds` (kept atoms), NOT `used` — a reserved id
    // is not a valid endpoint. Skip it entirely (and thus out of output_ids too).
    if (!atomIds.has(d.from_atom_id) || !atomIds.has(d.to_atom_id)) {
      return []
    }

    const base = {
      id: d.id,
      from_atom_id: d.from_atom_id,
      to_atom_id: d.to_atom_id,
      predicate: d.predicate,
      review_state: 'generated' as const,
    }
    // NORMALIZE empty anchor_ids: a present-but-empty list is not a valid
    // anchored relationship, so emit a no-anchor relationship (omit both
    // anchor_ids and support_state). Authoritative here regardless of adapter.
    if (d.anchor_ids !== undefined && d.anchor_ids.length > 0) {
      // Schema's dependentRequired: anchor_ids present => support_state required.
      if (d.support_state === undefined) {
        throw new Error(
          `extraction draft relationship "${d.id}" has anchor_ids but no support_state ` +
            `(support_state is required whenever anchor_ids is set).`,
        )
      }
      for (const anchorId of d.anchor_ids) {
        if (!validAnchorIds.has(anchorId)) {
          throw new UnknownAnchorError(anchorId, `relationship "${d.id}"`)
        }
      }
      return [
        {
          ...base,
          anchor_ids: d.anchor_ids,
          support_state: d.support_state,
        },
      ]
    }
    // No anchors (absent or normalized-from-empty): support_state stays absent
    // (valid; the human may add anchors later during review).
    return [base]
  })

  const derivation: DerivationRun = {
    id: args.derivationId,
    op: 'extract',
    input_ids: [args.sourceAssetId],
    output_ids: [...atoms.map((a) => a.id), ...relationships.map((r) => r.id)],
    actor: 'ai',
    ...(args.derivationExtras?.model_name !== undefined
      ? { model_name: args.derivationExtras.model_name }
      : {}),
    ...(args.derivationExtras?.model_snapshot !== undefined
      ? { model_snapshot: args.derivationExtras.model_snapshot }
      : {}),
    ...(args.derivationExtras?.prompt_hash !== undefined
      ? { prompt_hash: args.derivationExtras.prompt_hash }
      : {}),
    schema_version: '0',
    cost: args.cost,
    created_at: args.createdAt,
  }

  return { atoms, relationships, derivation }
}
