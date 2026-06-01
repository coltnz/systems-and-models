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
 */
export function assembleExtraction(args: AssembleArgs): {
  atoms: Atom[]
  relationships: Relationship[]
  derivation: DerivationRun
} {
  const { validAnchorIds } = args

  const atoms: Atom[] = args.draft.atoms.map((d) => {
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
    return atom
  })

  const relationships: Relationship[] = args.draft.relationships.map((d) => {
    const base = {
      id: d.id,
      from_atom_id: d.from_atom_id,
      to_atom_id: d.to_atom_id,
      predicate: d.predicate,
      review_state: 'generated' as const,
    }
    if (d.anchor_ids !== undefined) {
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
      return {
        ...base,
        anchor_ids: d.anchor_ids,
        support_state: d.support_state,
      }
    }
    // No anchors: support_state stays absent (valid; the human may add later).
    return base
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
