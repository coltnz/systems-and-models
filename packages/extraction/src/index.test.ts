import { describe, it, expect } from 'vitest'

import { ingestSource, type IngestResult } from '@sam/ingest'
import { validatePack } from '@sam/validator'
import type { LearningPack } from '@sam/types'

import {
  getAdapter,
  MockExtractionAdapter,
  OpenAIAdapter,
  OPENAI_PRICE_MAP,
  type ExtractionInput,
  type ExtractionResult,
} from './index.js'
import { buildResponseSchema, computeUsd, parseDraft } from './openai-adapter.js'
import {
  assembleExtraction,
  UnknownAnchorError,
  type DraftBundle,
} from './draft.js'

// A multi-paragraph Markdown transcript fixture (CC-licensed/authored shape).
const TRANSCRIPT = `# Compound Interest

Interest compounds when earnings are reinvested. Each period grows the principal, so growth accelerates over time.

A small rate, given enough time, beats a large rate over a short window.

Reinvested dividends are the clearest everyday example of compounding.
`

// Fixed clock for determinism (tz-aware instant).
const fixedNow = (): Date => new Date('2026-06-01T12:00:00.000Z')

function ingest(content: string): Promise<IngestResult> {
  return ingestSource(
    {
      uri: 'file:///transcripts/compound-interest.md',
      media_type: 'markdown',
      title: 'Compound Interest',
      creator: 'Test Author',
      license: 'CC-BY-4.0',
      access: 'open',
      content,
    },
    { now: fixedNow },
  )
}

/** Build the ExtractionInput from an ingest result. */
function toInput(ingestResult: IngestResult): ExtractionInput {
  return {
    source_asset_id: ingestResult.source.id,
    text: TRANSCRIPT,
    anchors: ingestResult.anchors,
  }
}

/**
 * Assemble a full LearningPack from an ingest result + an extraction result, in
 * the exact shape the server (bd-7) will persist.
 */
function toPack(
  ingestResult: IngestResult,
  extraction: ExtractionResult,
): LearningPack {
  return {
    id: 'pack-extract-test',
    title: 'Extraction test pack',
    version: '0.1.0',
    schema_version: '0',
    license: ingestResult.source.license,
    sources: [ingestResult.source],
    anchors: ingestResult.anchors,
    atoms: extraction.atoms,
    relationships: extraction.relationships,
    derivations: [ingestResult.derivation, extraction.derivation],
  }
}

describe('MockExtractionAdapter', () => {
  it('produces a draft pack that validates via @sam/validator (bd-4)', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const extraction = await new MockExtractionAdapter({ now: fixedNow }).extract(
      toInput(ingestResult),
    )

    const pack = toPack(ingestResult, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)

    // Atoms' derivation_id is the extract derivation, which is in derivations.
    for (const atom of extraction.atoms) {
      expect(atom.derivation_id).toBe(extraction.derivation.id)
    }
    expect(pack.derivations.map((d) => d.id)).toContain(extraction.derivation.id)
  })

  it('is deterministic: same input + same clock ⇒ deeply-equal result', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const input = toInput(ingestResult)
    const a = await new MockExtractionAdapter({ now: fixedNow }).extract(input)
    const b = await new MockExtractionAdapter({ now: fixedNow }).extract(input)
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('emits non-empty content for ≥1 anchor; cost is all-zero', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    expect(ingestResult.anchors.length).toBeGreaterThanOrEqual(2)

    const extraction = await new MockExtractionAdapter({ now: fixedNow }).extract(
      toInput(ingestResult),
    )
    expect(extraction.atoms.length).toBeGreaterThanOrEqual(1)
    // Fixture has ≥2 anchors ⇒ a model + claim atom and one relationship.
    expect(extraction.atoms.length).toBe(2)
    expect(extraction.relationships.length).toBe(1)

    expect(extraction.derivation.cost).toEqual({
      tokens_in: 0,
      tokens_out: 0,
      usd: 0,
    })
  })

  it('atoms reference ONLY input anchor ids; review_state generated; authored_by ai', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const validAnchorIds = new Set(ingestResult.anchors.map((a) => a.id))
    const extraction = await new MockExtractionAdapter({ now: fixedNow }).extract(
      toInput(ingestResult),
    )

    for (const atom of extraction.atoms) {
      expect(atom.review_state).toBe('generated')
      expect(atom.authored_by).toBe('ai')
      expect(atom.version).toBe(1)
      expect(atom.anchors.length).toBeGreaterThanOrEqual(1)
      for (const ref of atom.anchors) {
        expect(validAnchorIds.has(ref.anchor_id)).toBe(true)
      }
    }
    for (const rel of extraction.relationships) {
      expect(rel.review_state).toBe('generated')
      if (rel.anchor_ids) {
        expect(rel.support_state).toBeDefined()
        for (const id of rel.anchor_ids) {
          expect(validAnchorIds.has(id)).toBe(true)
        }
      }
    }
  })

  it('extract derivation is well-formed: op/actor/schema_version/ids/tz-aware created_at', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const extraction = await new MockExtractionAdapter({ now: fixedNow }).extract(
      toInput(ingestResult),
    )
    const der = extraction.derivation
    expect(der.op).toBe('extract')
    expect(der.actor).toBe('ai')
    expect(der.schema_version).toBe('0')
    expect(der.input_ids).toEqual([ingestResult.source.id])
    expect(der.output_ids).toEqual([
      ...extraction.atoms.map((a) => a.id),
      ...extraction.relationships.map((r) => r.id),
    ])
    expect(der.created_at).toBe('2026-06-01T12:00:00.000Z')
    expect(der.created_at).toMatch(/Z$/)
    // Deterministic id derived from the source (NOT time-based).
    expect(der.id).toBe(`der-extract-${ingestResult.source.id}`)
  })

  it('input.now overrides the adapter clock for the extract derivation created_at', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const inputInstant = '2027-03-04T05:06:07.000Z'
    // Adapter constructed with a DIFFERENT clock; input.now must take precedence.
    const extraction = await new MockExtractionAdapter({
      now: () => new Date('1999-01-01T00:00:00.000Z'),
    }).extract({ ...toInput(ingestResult), now: () => new Date(inputInstant) })
    expect(extraction.derivation.created_at).toBe(inputInstant)
  })

  it('returns empty atoms/relationships (but a valid derivation) for zero anchors', async () => {
    const extraction = await new MockExtractionAdapter({ now: fixedNow }).extract({
      source_asset_id: 'src-empty',
      text: '',
      anchors: [],
    })
    expect(extraction.atoms).toEqual([])
    expect(extraction.relationships).toEqual([])
    expect(extraction.derivation.op).toBe('extract')
    expect(extraction.derivation.output_ids).toEqual([])
    expect(extraction.derivation.cost).toEqual({
      tokens_in: 0,
      tokens_out: 0,
      usd: 0,
    })
  })

  it('emits exactly one model atom for a single-anchor input', async () => {
    const single = await ingest('Just one paragraph about systems thinking.')
    expect(single.anchors).toHaveLength(1)
    const extraction = await new MockExtractionAdapter({ now: fixedNow }).extract(
      toInput(single),
    )
    expect(extraction.atoms).toHaveLength(1)
    expect(extraction.atoms[0]!.kind).toBe('model')
    expect(extraction.relationships).toHaveLength(0)
    // Still validates.
    expect(validatePack(toPack(single, extraction)).ok).toBe(true)
  })
})

describe('getAdapter factory', () => {
  it('returns the mock by default', () => {
    const adapter = getAdapter()
    expect(adapter).toBeInstanceOf(MockExtractionAdapter)
    expect(adapter.name).toBe('mock')
  })

  it('returns the mock for EXTRACTION_ADAPTER=mock', () => {
    const adapter = getAdapter({ EXTRACTION_ADAPTER: 'mock' })
    expect(adapter).toBeInstanceOf(MockExtractionAdapter)
  })

  it('throws naming the missing OPENAI_API_KEY when openai is requested unconfigured', () => {
    expect(() => getAdapter({ EXTRACTION_ADAPTER: 'openai' })).toThrow(
      /OPENAI_API_KEY/,
    )
  })

  it('throws naming OPENAI_MODEL when the key is set but the model is not', () => {
    expect(() =>
      getAdapter({ EXTRACTION_ADAPTER: 'openai', OPENAI_API_KEY: 'sk-test' }),
    ).toThrow(/OPENAI_MODEL/)
  })

  it('constructs the OpenAI adapter when fully configured (no network call)', () => {
    const adapter = getAdapter({
      EXTRACTION_ADAPTER: 'openai',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-4o-mini',
    })
    expect(adapter).toBeInstanceOf(OpenAIAdapter)
    expect(adapter.name).toBe('openai')
  })
})

describe('OpenAIAdapter parseDraft normalization (no network)', () => {
  it('normalizes a relationship with empty anchor_ids to a valid no-anchor relationship that validates', async () => {
    // A real source + its anchors so the assembled pack references real ids.
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    expect(a1).toBeDefined()
    expect(a2).toBeDefined()

    // Model output where the relationship emits anchor_ids: [] (allowed by the
    // strict structured-output schema, which marks anchor_ids required).
    const content = JSON.stringify({
      atoms: [
        {
          id: 'atom-1',
          kind: 'model',
          title: 'Compounding',
          summary: 'Earnings reinvested compound.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        {
          id: 'atom-2',
          kind: 'claim',
          title: 'Small rate beats',
          summary: 'A small rate over time beats a large rate over a short window.',
          body: 'A small rate, given enough time, beats a large rate over a short window.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
      ],
      relationships: [
        {
          id: 'rel-1',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
          anchor_ids: [],
          support_state: 'partially',
        },
      ],
    })

    const draft = parseDraft(content)
    // The empty-anchor relationship has BOTH fields omitted in the draft.
    expect(draft.relationships).toHaveLength(1)
    expect('anchor_ids' in draft.relationships[0]!).toBe(false)
    expect('support_state' in draft.relationships[0]!).toBe(false)

    const validAnchorIds = new Set(ingestResult.anchors.map((a) => a.id))
    const extraction = assembleExtraction({
      sourceAssetId: ingestResult.source.id,
      derivationId: `der-extract-${ingestResult.source.id}`,
      validAnchorIds,
      draft,
      cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
      createdAt: '2026-06-01T12:00:00.000Z',
      derivationExtras: { model_name: 'gpt-4o-mini' },
    })

    // The assembled relationship carries neither anchor_ids nor support_state.
    const rel = extraction.relationships[0]!
    expect('anchor_ids' in rel).toBe(false)
    expect('support_state' in rel).toBe(false)

    // And the wrapped pack validates cleanly (no relationship_empty_anchor_ids).
    const pack = toPack(ingestResult, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })
})

describe('OpenAIAdapter parseDraft runtime enum validation (bd-15)', () => {
  // A minimal well-formed draft, parametrized so each test can corrupt exactly
  // ONE enum field and assert parseDraft throws a clear, located error.
  function draftWith(overrides: {
    kind?: string
    atomSupport?: string
    predicate?: string
    relSupport?: string
  }): string {
    return JSON.stringify({
      atoms: [
        {
          id: 'atom-1',
          kind: overrides.kind ?? 'model',
          title: 'Compounding',
          summary: 'Earnings reinvested compound.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [
            { anchor_id: 'anc-1', support_state: overrides.atomSupport ?? 'supports' },
          ],
        },
        {
          id: 'atom-2',
          kind: 'claim',
          title: 'Small rate beats',
          summary: 'A small rate over time beats a large rate.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: 'anc-2', support_state: 'partially' }],
        },
      ],
      relationships: [
        {
          id: 'rel-1',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: overrides.predicate ?? 'explains',
          anchor_ids: ['anc-1'],
          support_state: overrides.relSupport ?? 'supports',
        },
      ],
    })
  }

  it('a well-formed draft (all enums in range) parses without throwing', () => {
    expect(() => parseDraft(draftWith({}))).not.toThrow()
  })

  it('throws a clear, located error for an out-of-enum atom kind', () => {
    expect(() => parseDraft(draftWith({ kind: 'fact' }))).toThrow(
      'OpenAI extraction: invalid kind "fact" at atoms[0].kind',
    )
  })

  it('throws a clear, located error for an out-of-enum relationship predicate', () => {
    expect(() => parseDraft(draftWith({ predicate: 'causes' }))).toThrow(
      'OpenAI extraction: invalid predicate "causes" at relationships[0].predicate',
    )
  })

  it('throws a clear, located error for an out-of-enum atom anchor support_state', () => {
    expect(() => parseDraft(draftWith({ atomSupport: 'maybe' }))).toThrow(
      'OpenAI extraction: invalid support_state "maybe" at atoms[0].anchors[0].support_state',
    )
  })

  it('throws a clear, located error for an out-of-enum relationship support_state', () => {
    expect(() => parseDraft(draftWith({ relSupport: 'unsure' }))).toThrow(
      'OpenAI extraction: invalid support_state "unsure" at relationships[0].support_state',
    )
  })
})

describe('OpenAIAdapter response schema (bd-15)', () => {
  it('requires minItems:1 on atom anchors so an atom can never have anchors: []', () => {
    const schema = buildResponseSchema(['anc-1', 'anc-2'])
    const atoms = (schema.properties as Record<string, { items: unknown }>).atoms
    const atomItem = atoms.items as { properties: Record<string, unknown> }
    const anchors = atomItem.properties.anchors as { minItems?: number }
    expect(anchors.minItems).toBe(1)
  })
})

describe('assembleExtraction relationship graph-ref hygiene (bd-12)', () => {
  // Helpers: assemble a bundle against a real source's anchors, then wrap the
  // result in a full LearningPack for end-to-end validation.
  async function assembleBundle(draft: DraftBundle): Promise<{
    ingestResult: IngestResult
    extraction: ExtractionResult
  }> {
    const ingestResult = await ingest(TRANSCRIPT)
    const validAnchorIds = new Set(ingestResult.anchors.map((a) => a.id))
    const extraction = assembleExtraction({
      sourceAssetId: ingestResult.source.id,
      derivationId: `der-extract-${ingestResult.source.id}`,
      validAnchorIds,
      draft,
      cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
      createdAt: '2026-06-01T12:00:00.000Z',
    })
    return { ingestResult, extraction }
  }

  // Two atoms, each anchored to a real input anchor — reusable across cases.
  function twoAtoms(
    a1Id: string,
    a2Id: string,
  ): DraftBundle['atoms'] {
    return [
      {
        id: 'atom-1',
        kind: 'model',
        title: 'Compounding',
        summary: 'Earnings reinvested compound.',
        body: 'Interest compounds when earnings are reinvested.',
        anchors: [{ anchor_id: a1Id, support_state: 'supports' }],
      },
      {
        id: 'atom-2',
        kind: 'claim',
        title: 'Small rate beats',
        summary: 'A small rate over time beats a large rate.',
        body: 'A small rate, given enough time, beats a large rate over a short window.',
        anchors: [{ anchor_id: a2Id, support_state: 'partially' }],
      },
    ]
  }

  it('DROPS a relationship with a dangling from/to atom; keeps the sibling valid edge', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: twoAtoms(a1!.id, a2!.id),
      relationships: [
        // Valid sibling edge (both endpoints exist).
        {
          id: 'rel-valid',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
        },
        // Dangling from_atom_id (not an atom in this draft).
        {
          id: 'rel-bad-from',
          from_atom_id: 'atom-MISSING',
          to_atom_id: 'atom-2',
          predicate: 'explains',
        },
        // Dangling to_atom_id (not an atom in this draft).
        {
          id: 'rel-bad-to',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-MISSING',
          predicate: 'explains',
        },
      ],
    }

    const { extraction } = await assembleBundle(draft)

    const relIds = extraction.relationships.map((r) => r.id)
    expect(relIds).toEqual(['rel-valid'])
    expect(relIds).not.toContain('rel-bad-from')
    expect(relIds).not.toContain('rel-bad-to')

    // The dropped edges are absent from derivation.output_ids too.
    expect(extraction.derivation.output_ids).toContain('rel-valid')
    expect(extraction.derivation.output_ids).not.toContain('rel-bad-from')
    expect(extraction.derivation.output_ids).not.toContain('rel-bad-to')
    expect(extraction.derivation.output_ids).toEqual([
      'atom-1',
      'atom-2',
      'rel-valid',
    ])
  })

  it('NORMALIZES empty anchor_ids to a no-anchor relationship; wrapped pack validates clean', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: twoAtoms(a1!.id, a2!.id),
      relationships: [
        {
          id: 'rel-empty',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
          anchor_ids: [],
          support_state: 'partially',
        },
      ],
    }

    const { extraction } = await assembleBundle(draft)

    expect(extraction.relationships).toHaveLength(1)
    const rel = extraction.relationships[0]!
    expect('anchor_ids' in rel).toBe(false)
    expect('support_state' in rel).toBe(false)

    const pack = toPack(ingestResult, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })

  it('still THROWS UnknownAnchorError for a NON-empty anchor_ids referencing an unknown anchor (unchanged guarantee)', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const validAnchorIds = new Set(ingestResult.anchors.map((a) => a.id))
    const draft: DraftBundle = {
      atoms: twoAtoms(a1!.id, a2!.id),
      relationships: [
        {
          id: 'rel-invented',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
          anchor_ids: ['anchor-NEVER-EXISTED'],
          support_state: 'partially',
        },
      ],
    }

    expect(() =>
      assembleExtraction({
        sourceAssetId: ingestResult.source.id,
        derivationId: `der-extract-${ingestResult.source.id}`,
        validAnchorIds,
        draft,
        cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
        createdAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toThrow(UnknownAnchorError)
  })

  it('assembled pack ALWAYS validates: valid + dangling + empty-anchor edges ⇒ only valid/normalized kept', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: twoAtoms(a1!.id, a2!.id),
      relationships: [
        // A fully valid anchored edge.
        {
          id: 'rel-good',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
          anchor_ids: [a1!.id, a2!.id],
          support_state: 'supports',
        },
        // A dangling-endpoint edge (dropped).
        {
          id: 'rel-dangling',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-GONE',
          predicate: 'supports',
        },
        // An empty-anchor edge (normalized to no-anchor).
        {
          id: 'rel-empty',
          from_atom_id: 'atom-2',
          to_atom_id: 'atom-1',
          predicate: 'requires',
          anchor_ids: [],
          support_state: 'partially',
        },
      ],
    }

    const { extraction } = await assembleBundle(draft)

    // Dangling dropped; the other two kept in input order.
    expect(extraction.relationships.map((r) => r.id)).toEqual([
      'rel-good',
      'rel-empty',
    ])
    // The normalized one has no anchors; the good one keeps its anchors.
    const good = extraction.relationships.find((r) => r.id === 'rel-good')!
    const empty = extraction.relationships.find((r) => r.id === 'rel-empty')!
    expect(good.anchor_ids).toEqual([a1!.id, a2!.id])
    expect('anchor_ids' in empty).toBe(false)
    expect('support_state' in empty).toBe(false)

    // output_ids reflects exactly the kept relationships (plus atoms).
    expect(extraction.derivation.output_ids).toEqual([
      'atom-1',
      'atom-2',
      'rel-good',
      'rel-empty',
    ])

    // The wrapped pack validates with zero errors (no graph errors at all).
    const pack = toPack(ingestResult, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })
})

describe('assembleExtraction duplicate-id dedupe (bd-13)', () => {
  // Assemble a bundle against a real source's anchors, then wrap the result in a
  // full LearningPack for end-to-end validation.
  async function assembleBundle(draft: DraftBundle): Promise<{
    ingestResult: IngestResult
    extraction: ExtractionResult
  }> {
    const ingestResult = await ingest(TRANSCRIPT)
    const validAnchorIds = new Set(ingestResult.anchors.map((a) => a.id))
    const extraction = assembleExtraction({
      sourceAssetId: ingestResult.source.id,
      derivationId: `der-extract-${ingestResult.source.id}`,
      validAnchorIds,
      draft,
      cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
      createdAt: '2026-06-01T12:00:00.000Z',
    })
    return { ingestResult, extraction }
  }

  it('DROPS a duplicate-id atom (keep FIRST); pack validates with no duplicate_id', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: [
        {
          id: 'atom-dup',
          kind: 'model',
          title: 'First — kept',
          summary: 'The first definition is the one that survives.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        // Same id as the first atom — the validator would flag duplicate_id.
        {
          id: 'atom-dup',
          kind: 'claim',
          title: 'Second — dropped',
          summary: 'This later duplicate must be dropped.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
      ],
      relationships: [],
    }

    const { ingestResult: ir, extraction } = await assembleBundle(draft)

    // Only the FIRST atom is kept.
    expect(extraction.atoms).toHaveLength(1)
    expect(extraction.atoms[0]!.id).toBe('atom-dup')
    expect(extraction.atoms[0]!.title).toBe('First — kept')

    // output_ids carries the kept atom once, no duplicate.
    expect(extraction.derivation.output_ids).toEqual(['atom-dup'])

    const pack = toPack(ir, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })

  it('DROPS a duplicate-id relationship (keep FIRST, both endpoints valid); pack validates', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: [
        {
          id: 'atom-1',
          kind: 'model',
          title: 'Compounding',
          summary: 'Earnings reinvested compound.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        {
          id: 'atom-2',
          kind: 'claim',
          title: 'Small rate beats',
          summary: 'A small rate over time beats a large rate.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
      ],
      relationships: [
        {
          id: 'rel-dup',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
        },
        // Same id (both endpoints valid) — dropped as a duplicate.
        {
          id: 'rel-dup',
          from_atom_id: 'atom-2',
          to_atom_id: 'atom-1',
          predicate: 'requires',
        },
      ],
    }

    const { ingestResult: ir, extraction } = await assembleBundle(draft)

    // Only the FIRST relationship is kept.
    expect(extraction.relationships).toHaveLength(1)
    expect(extraction.relationships[0]!.id).toBe('rel-dup')
    expect(extraction.relationships[0]!.predicate).toBe('explains')
    expect(extraction.relationships[0]!.from_atom_id).toBe('atom-1')

    // output_ids carries the kept relationship once, no duplicate.
    expect(extraction.derivation.output_ids).toEqual([
      'atom-1',
      'atom-2',
      'rel-dup',
    ])

    const pack = toPack(ir, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })

  it('mixed bundle: dup atom + dup rel + dangling edge + empty-anchor edge ⇒ only unique/valid/normalized; pack validates', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: [
        {
          id: 'atom-1',
          kind: 'model',
          title: 'Compounding',
          summary: 'Earnings reinvested compound.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        {
          id: 'atom-2',
          kind: 'claim',
          title: 'Small rate beats',
          summary: 'A small rate over time beats a large rate.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
        // Duplicate-id atom — dropped (keep first atom-1).
        {
          id: 'atom-1',
          kind: 'claim',
          title: 'Duplicate atom — dropped',
          summary: 'Later duplicate of atom-1.',
          body: 'Reinvested dividends are the clearest everyday example.',
          anchors: [{ anchor_id: a2!.id, support_state: 'supports' }],
        },
      ],
      relationships: [
        // Fully valid anchored edge — kept.
        {
          id: 'rel-good',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
          anchor_ids: [a1!.id, a2!.id],
          support_state: 'supports',
        },
        // Duplicate-id relationship — dropped (keep first rel-good).
        {
          id: 'rel-good',
          from_atom_id: 'atom-2',
          to_atom_id: 'atom-1',
          predicate: 'requires',
        },
        // Dangling-endpoint edge (bd-12) — dropped.
        {
          id: 'rel-dangling',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-GONE',
          predicate: 'supports',
        },
        // Empty-anchor edge (bd-12) — normalized to a no-anchor relationship.
        {
          id: 'rel-empty',
          from_atom_id: 'atom-2',
          to_atom_id: 'atom-1',
          predicate: 'requires',
          anchor_ids: [],
          support_state: 'partially',
        },
      ],
    }

    const { ingestResult: ir, extraction } = await assembleBundle(draft)

    // Only the unique atom ids survive (keep first).
    expect(extraction.atoms.map((a) => a.id)).toEqual(['atom-1', 'atom-2'])

    // Kept relationships, in order: the unique valid edge + the normalized one.
    expect(extraction.relationships.map((r) => r.id)).toEqual([
      'rel-good',
      'rel-empty',
    ])
    const good = extraction.relationships.find((r) => r.id === 'rel-good')!
    const empty = extraction.relationships.find((r) => r.id === 'rel-empty')!
    expect(good.anchor_ids).toEqual([a1!.id, a2!.id])
    expect('anchor_ids' in empty).toBe(false)
    expect('support_state' in empty).toBe(false)

    // output_ids reflects exactly the kept items, with no duplicates (the exact
    // array assertion below is itself proof there is no repeated id).
    const outputIds = extraction.derivation.output_ids ?? []
    expect(outputIds).toEqual(['atom-1', 'atom-2', 'rel-good', 'rel-empty'])
    expect(new Set(outputIds).size).toBe(outputIds.length)

    const pack = toPack(ir, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })
})

describe('assembleExtraction pack-global id uniqueness (bd-15)', () => {
  // Assemble against a real source's anchors, then wrap for end-to-end validation.
  async function assembleBundle(draft: DraftBundle): Promise<{
    ingestResult: IngestResult
    extraction: ExtractionResult
  }> {
    const ingestResult = await ingest(TRANSCRIPT)
    const validAnchorIds = new Set(ingestResult.anchors.map((a) => a.id))
    const extraction = assembleExtraction({
      sourceAssetId: ingestResult.source.id,
      derivationId: `der-extract-${ingestResult.source.id}`,
      validAnchorIds,
      draft,
      cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
      createdAt: '2026-06-01T12:00:00.000Z',
    })
    return { ingestResult, extraction }
  }

  it('DROPS an atom whose id collides with an INPUT ANCHOR id (reserved); pack validates clean', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: [
        // This atom's id collides with a reserved input anchor id — must be dropped.
        {
          id: a1!.id,
          kind: 'model',
          title: 'Colliding atom — dropped',
          summary: 'Its id equals an input anchor id.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        // A normal, non-colliding atom — kept.
        {
          id: 'atom-2',
          kind: 'claim',
          title: 'Small rate beats',
          summary: 'A small rate over time beats a large rate.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
      ],
      relationships: [],
    }

    const { ingestResult: ir, extraction } = await assembleBundle(draft)

    // The colliding atom is gone; only the clean one survives.
    expect(extraction.atoms.map((a) => a.id)).toEqual(['atom-2'])
    expect(extraction.derivation.output_ids).toEqual(['atom-2'])

    const pack = toPack(ir, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })

  it('DROPS a relationship whose id collides with a kept ATOM id; pack validates clean', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: [
        {
          id: 'atom-1',
          kind: 'model',
          title: 'Compounding',
          summary: 'Earnings reinvested compound.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        {
          id: 'atom-2',
          kind: 'claim',
          title: 'Small rate beats',
          summary: 'A small rate over time beats a large rate.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
      ],
      relationships: [
        // id collides with kept atom "atom-1" — cross-collection collision; dropped.
        {
          id: 'atom-1',
          from_atom_id: 'atom-1',
          to_atom_id: 'atom-2',
          predicate: 'explains',
        },
        // A normal, non-colliding relationship — kept.
        {
          id: 'rel-ok',
          from_atom_id: 'atom-2',
          to_atom_id: 'atom-1',
          predicate: 'requires',
        },
      ],
    }

    const { ingestResult: ir, extraction } = await assembleBundle(draft)

    expect(extraction.relationships.map((r) => r.id)).toEqual(['rel-ok'])
    expect(extraction.derivation.output_ids).toEqual([
      'atom-1',
      'atom-2',
      'rel-ok',
    ])

    const pack = toPack(ir, extraction)
    const validation = validatePack(pack)
    // Specifically: no cross_collection_duplicate_id (and no errors at all).
    expect(validation.errors.map((e) => e.code)).not.toContain(
      'cross_collection_duplicate_id',
    )
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })

  it('DROPS an atom whose id collides with the source asset id (reserved); pack validates clean', async () => {
    const ingestResult = await ingest(TRANSCRIPT)
    const [a1, a2] = ingestResult.anchors
    const draft: DraftBundle = {
      atoms: [
        // id collides with the reserved source asset id — dropped.
        {
          id: ingestResult.source.id,
          kind: 'model',
          title: 'Collides with source id — dropped',
          summary: 'Reserved id collision.',
          body: 'Interest compounds when earnings are reinvested.',
          anchors: [{ anchor_id: a1!.id, support_state: 'supports' }],
        },
        {
          id: 'atom-keep',
          kind: 'claim',
          title: 'Kept',
          summary: 'A clean atom.',
          body: 'A small rate, given enough time, beats a large rate.',
          anchors: [{ anchor_id: a2!.id, support_state: 'partially' }],
        },
      ],
      relationships: [],
    }

    const { ingestResult: ir, extraction } = await assembleBundle(draft)
    expect(extraction.atoms.map((a) => a.id)).toEqual(['atom-keep'])

    const pack = toPack(ir, extraction)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })
})

describe('OpenAIAdapter cost / price map (no network)', () => {
  it('computes usd from the documented price map', () => {
    // 1,000,000 input + 1,000,000 output tokens on gpt-4o-mini.
    const usd = computeUsd('gpt-4o-mini', 1_000_000, 1_000_000)
    expect(usd).toBeCloseTo(
      OPENAI_PRICE_MAP['gpt-4o-mini']!.inputPerMTok +
        OPENAI_PRICE_MAP['gpt-4o-mini']!.outputPerMTok,
      6,
    )
  })

  it('returns usd 0 (never fabricated) for an unknown model', () => {
    expect(computeUsd('some-unlisted-model', 1_000_000, 1_000_000)).toBe(0)
  })

  it('zero tokens ⇒ zero usd', () => {
    expect(computeUsd('gpt-4o', 0, 0)).toBe(0)
  })
})
