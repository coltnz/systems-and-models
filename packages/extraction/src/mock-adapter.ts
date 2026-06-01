/**
 * MockExtractionAdapter — deterministic, zero-network, zero-cost extraction.
 *
 * Backs ALL tests and the offline alpha demo (bd-10). Given the input anchors it
 * emits a small, FIXED, plausible DRAFT derived deterministically from the
 * input:
 *   - a `model` atom anchored to the FIRST input anchor,
 *   - a `claim` atom anchored to the SECOND input anchor (if present),
 *   - one `generated` relationship (`model` --explains--> `claim`) when there are
 *     at least two atoms, anchored to both anchors.
 *
 * Ids are derived from `source_asset_id` (e.g. `atom-<sourceId>-1`), never
 * time-based; the only time-dependent value is the derivation's `created_at`,
 * sourced from an injectable clock. So: same input + same clock => deeply-equal
 * result. Cost is always all-zero (NEVER fabricated).
 *
 * If given ZERO anchors it returns empty atoms/relationships but still a valid
 * `extract` derivation. With >=1 anchor it always produces NON-EMPTY content, so
 * bd-10's offline demo has reviewable atoms.
 */
import type { SourceAnchor } from '@sam/types'

import {
  assembleExtraction,
  type DraftAtom,
  type DraftBundle,
  type DraftRelationship,
} from './draft.js'
import type {
  ExtractionAdapter,
  ExtractionInput,
  ExtractionResult,
} from './index.js'

export interface MockExtractionOptions {
  /**
   * Clock for the derivation's `created_at`. Injected for determinism. Defaults
   * to `() => new Date()`. `toISOString()` is always `Z`-suffixed → tz-aware,
   * satisfying the validator (bd-4).
   */
  now?: () => Date
}

const DEFAULT_NOW = (): Date => new Date()

/**
 * Truncate an excerpt to a short, deterministic title/summary snippet. Pure:
 * same excerpt => same snippet. Keeps draft text small but recognizably derived
 * from the source.
 */
function snippet(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1).trimEnd()}…`
}

export class MockExtractionAdapter implements ExtractionAdapter {
  readonly name = 'mock'

  private readonly now: () => Date

  constructor(opts: MockExtractionOptions = {}) {
    this.now = opts.now ?? DEFAULT_NOW
  }

  extract(input: ExtractionInput): Promise<ExtractionResult> {
    const derivationId = `der-extract-${input.source_asset_id}`
    const validAnchorIds = new Set(input.anchors.map((a) => a.id))
    const draft = buildMockDraft(input.source_asset_id, input.anchors)

    const result = assembleExtraction({
      sourceAssetId: input.source_asset_id,
      derivationId,
      validAnchorIds,
      draft,
      // NEVER fabricate cost: the mock makes no API call.
      cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
      createdAt: this.now().toISOString(),
    })

    return Promise.resolve(result)
  }
}

/**
 * Build the fixed, deterministic mock draft from the input anchors. Exported for
 * unit clarity; the shape is the contract bd-10's demo leans on.
 */
function buildMockDraft(
  sourceId: string,
  anchors: SourceAnchor[],
): DraftBundle {
  const atoms: DraftAtom[] = []
  const relationships: DraftRelationship[] = []

  const first = anchors[0]
  const second = anchors[1]

  if (first) {
    atoms.push({
      id: `atom-${sourceId}-1`,
      kind: 'model',
      title: snippet(first.excerpt, 80),
      summary: snippet(first.excerpt, 200),
      body: first.excerpt,
      // Propose "supports"; the human confirms during review.
      anchors: [{ anchor_id: first.id, support_state: 'supports' }],
    })
  }

  if (second) {
    atoms.push({
      id: `atom-${sourceId}-2`,
      kind: 'claim',
      title: snippet(second.excerpt, 80),
      summary: snippet(second.excerpt, 200),
      body: second.excerpt,
      // Propose "partially"; the human confirms during review.
      anchors: [{ anchor_id: second.id, support_state: 'partially' }],
    })
  }

  if (atoms.length >= 2 && first && second) {
    relationships.push({
      id: `rel-${sourceId}-1`,
      from_atom_id: atoms[0]!.id,
      to_atom_id: atoms[1]!.id,
      predicate: 'explains',
      anchor_ids: [first.id, second.id],
      support_state: 'partially',
    })
  }

  return { atoms, relationships }
}
