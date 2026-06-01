import { describe, it, expect } from 'vitest'

import { validatePack } from '@sam/validator'
import type { LearningPack } from '@sam/types'

import {
  ingestSource,
  verifyAnchor,
  normalizeText,
  contentHash,
  deriveSourceId,
  UnsupportedMediaTypeError,
  type IngestResult,
} from './index.js'

// A multi-paragraph Markdown transcript fixture. Blank lines separate
// paragraphs; one paragraph spans multiple lines to exercise interior-newline
// preservation; trailing blank lines exercise boundary trimming.
const TRANSCRIPT = `# Compound Interest

Interest compounds when earnings are reinvested.
Each period grows the principal, so growth accelerates over time.

> The most powerful force in the universe is compound interest.

A small rate, given enough time, beats a large rate over a short window.
`

// Fixed clock for determinism (any tz-aware instant).
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

/** Wrap an ingest result into a minimal LearningPack for bd-4 validation. */
function toPack(result: IngestResult): LearningPack {
  return {
    id: 'pack-ingest-test',
    title: 'Ingest test pack',
    version: '0.1.0',
    schema_version: '0',
    license: result.source.license,
    sources: [result.source],
    anchors: result.anchors,
    atoms: [],
    relationships: [],
    derivations: [result.derivation],
  }
}

describe('@sam/ingest', () => {
  it('ingests a multi-paragraph markdown transcript into asset + anchors', async () => {
    const result = await ingest(TRANSCRIPT)

    expect(result.source.id).toMatch(/^src-[0-9a-f]{12}$/)
    expect(result.source.media_type).toBe('markdown')
    expect(result.source.title).toBe('Compound Interest')
    expect(result.source.creator).toBe('Test Author')
    expect(result.source.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/)

    // Four non-empty paragraph spans in the fixture.
    expect(result.anchors).toHaveLength(4)
    for (const anchor of result.anchors) {
      expect(anchor.selector.kind).toBe('text_quote')
      expect(anchor.extraction_method).toBe('native')
      expect(anchor.source_asset_id).toBe(result.source.id)
      // Excerpt never has leading/trailing whitespace (boundary-trimmed span).
      expect(anchor.excerpt).toBe(anchor.excerpt.trim())
    }

    // The multi-line paragraph keeps its interior newline verbatim.
    const multiline = result.anchors.find((a) => a.excerpt.includes('\n'))
    expect(multiline?.excerpt).toContain(
      'Interest compounds when earnings are reinvested.\nEach period',
    )

    // Derivation links source -> anchors.
    expect(result.derivation.op).toBe('ingest')
    expect(result.derivation.actor).toBe('ai')
    expect(result.derivation.schema_version).toBe('0')
    expect(result.derivation.input_ids).toEqual([result.source.id])
    expect(result.derivation.output_ids).toEqual(
      result.anchors.map((a) => a.id),
    )
    expect(result.derivation.created_at).toBe('2026-06-01T12:00:00.000Z')
    // Timezone-aware (trailing Z).
    expect(result.derivation.created_at).toMatch(/Z$/)
  })

  it('produces a pack that validates via @sam/validator (bd-4)', async () => {
    const result = await ingest(TRANSCRIPT)
    const pack = toPack(result)
    const validation = validatePack(pack)
    expect(validation.errors).toEqual([])
    expect(validation.ok).toBe(true)
  })

  it('round-trips: every anchor re-derives its excerpt (all verifiable)', async () => {
    const result = await ingest(TRANSCRIPT)
    const normalized = normalizeText(TRANSCRIPT)
    for (const anchor of result.anchors) {
      const start = Number(anchor.selector.start)
      const end = Number(anchor.selector.end)
      expect(normalized.slice(start, end)).toBe(anchor.excerpt)
      expect(verifyAnchor(anchor, normalized)).toBe(true)
      expect(anchor.verifiable).toBe(true)
    }
  })

  it('is deterministic: same input + same clock ⇒ deeply-equal result', async () => {
    const a = await ingest(TRANSCRIPT)
    const b = await ingest(TRANSCRIPT)
    expect(a).toEqual(b)
    // Byte-identical when serialized.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('rejects unsupported media types', () => {
    expect(() =>
      ingestSource({
        uri: 'https://example.com/clip.mp4',
        media_type: 'video' as unknown as 'text',
        title: 'A video',
        license: 'open',
        access: 'open',
        content: 'irrelevant',
      }),
    ).toThrow(UnsupportedMediaTypeError)
    expect(() =>
      ingestSource({
        uri: 'https://example.com/clip.mp4',
        media_type: 'video' as unknown as 'text',
        title: 'A video',
        license: 'open',
        access: 'open',
        content: 'irrelevant',
      }),
    ).toThrow(/not supported in alpha/i)

    // The single allowlist guard rejects EVERY non-text-shaped media type — the
    // schema-enum types that used to live in a separate blocklist (pdf/audio/
    // html) AND an arbitrary unknown value — all via UnsupportedMediaTypeError.
    for (const mt of ['pdf', 'audio', 'html', 'totally-made-up']) {
      expect(() =>
        ingestSource({
          uri: 'inline:x',
          media_type: mt as unknown as 'text',
          title: 'x',
          license: 'open',
          access: 'open',
          content: 'irrelevant',
        }),
      ).toThrow(UnsupportedMediaTypeError)
    }
  })

  it('content hash is stable, sha256:-prefixed, and CRLF/LF normalize equal', async () => {
    const lf = 'First paragraph.\n\nSecond paragraph.'
    const crlf = 'First paragraph.\r\n\r\nSecond paragraph.'
    const cr = 'First paragraph.\r\rSecond paragraph.'

    const hashLf = contentHash(normalizeText(lf))
    expect(hashLf).toMatch(/^sha256:[0-9a-f]{64}$/)
    // Different line endings → identical normalized text → identical hash + id.
    expect(contentHash(normalizeText(crlf))).toBe(hashLf)
    expect(contentHash(normalizeText(cr))).toBe(hashLf)
    expect(deriveSourceId(normalizeText(crlf))).toBe(
      deriveSourceId(normalizeText(lf)),
    )

    // And the full ingest result is identical across CRLF vs LF inputs.
    const rLf = await ingest(lf)
    const rCrlf = await ingest(crlf)
    expect(rCrlf).toEqual(rLf)
  })

  it('skips whitespace-only spans (no empty anchors)', async () => {
    const result = await ingest('Alpha.\n\n   \n\t\n\nBeta.')
    expect(result.anchors).toHaveLength(2)
    expect(result.anchors.map((a) => a.excerpt)).toEqual(['Alpha.', 'Beta.'])
    for (const anchor of result.anchors) {
      expect(anchor.excerpt.trim().length).toBeGreaterThan(0)
    }
  })

  it('accepts plain text media_type', async () => {
    const result = await ingestSource(
      {
        uri: 'file:///note.txt',
        media_type: 'text',
        title: 'Note',
        license: 'open',
        access: 'owned',
        content: 'Just one paragraph.',
      },
      { now: fixedNow },
    )
    expect(result.source.media_type).toBe('text')
    expect(result.anchors).toHaveLength(1)
    expect(result.anchors[0]!.excerpt).toBe('Just one paragraph.')
    expect(validatePack(toPack(result)).ok).toBe(true)
  })
})
