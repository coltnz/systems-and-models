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
import { computeUsd, parseDraft } from './openai-adapter.js'
import { assembleExtraction } from './draft.js'

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
