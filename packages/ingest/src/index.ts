/**
 * @sam/ingest — turn a raw source into a stored SourceAsset + verifiable anchors.
 *
 * bd-5 implementation. This package is deterministic, filesystem-free, and
 * network-free (D-007: the server reads files and hands us the content; we
 * return pure data and the server persists it). Alpha scope is transcript /
 * Markdown / plain text only — no ASR/video/audio/pdf/html (bd-5 constraint).
 *
 * Pipeline:
 *   1. Validate the request (reject unsupported media types).
 *   2. Normalize the text deterministically (line endings only).
 *   3. Content-hash the normalized text (sha256) and derive a stable asset id.
 *   4. Segment into SENTENCE spans (within blank-line paragraph blocks) and emit
 *      a `SourceAnchor` per non-empty span with char-offset selectors and the
 *      exact normalized substring as excerpt (bd-17 / issue #4).
 *   5. Emit an `ingest` `DerivationRun` linking the source to the anchors.
 *
 * Determinism: every value in the result is a pure function of `content` plus
 * the injected clock (`opts.now`). There is no `Date.now()`/random in the data
 * path. Same `content` + same `now` ⇒ byte-identical `IngestResult`.
 */
import { createHash } from 'node:crypto'

import type {
  Access,
  DerivationActor,
  DerivationRun,
  SourceAnchor,
  SourceAsset,
} from '@sam/types'

// --- Public types -----------------------------------------------------------

/**
 * Media types this package can ingest in the alpha. The wider schema enum
 * (`video|audio|pdf|html|markdown|text`) is intentionally NOT accepted here:
 * only text-shaped sources have a native, re-derivable character offset model.
 */
export type IngestMediaType = 'markdown' | 'text'

/**
 * What the caller hands us to ingest.
 *
 * Because this package is filesystem-free (D-007), the caller (the server) is
 * responsible for reading the file and passing its decoded text via `content`.
 * `uri` is recorded for provenance only; we never fetch it.
 */
export interface IngestRequest {
  /** Where the source came from. Recorded on the asset; never fetched. */
  uri: string
  /** Alpha supports text-shaped sources only. */
  media_type: IngestMediaType
  title: string
  creator?: string
  /** e.g. CC-BY-4.0, or 'creator-authorized'. */
  license: string
  access: Access
  /** The decoded source text. Read by the server, passed in here (D-007). */
  content: string
}

/**
 * Pure result of ingestion: the asset, its verifiable anchors, and the
 * provenance record (`DerivationRun`) that ties them together.
 */
export interface IngestResult {
  source: SourceAsset
  anchors: SourceAnchor[]
  derivation: DerivationRun
}

/**
 * Injection seams for determinism. Tests pass a fixed clock and (optionally) a
 * fixed actor; production uses the defaults.
 */
export interface IngestOptions {
  /**
   * Clock used for `DerivationRun.created_at`. Injected so tests are
   * deterministic. Defaults to `() => new Date()`. `toISOString()` is always
   * `Z`-suffixed, satisfying the validator's timezone-aware requirement (bd-4).
   */
  now?: () => Date
  /** Who ran the ingest. Defaults to `"ai"`. */
  actor?: DerivationActor
}

// --- Errors -----------------------------------------------------------------

/** Thrown when the request asks for something the alpha ingestor cannot do. */
export class UnsupportedMediaTypeError extends Error {
  constructor(mediaType: string) {
    super(
      `media_type "${mediaType}" is not supported in alpha — ingest accepts ` +
        `"markdown" or "text" only (no ASR/video/audio/pdf/html).`,
    )
    this.name = 'UnsupportedMediaTypeError'
  }
}

// --- Normalization + hashing ------------------------------------------------

/**
 * Normalize source text deterministically for stable offsets across OSes.
 *
 * The ONLY transformation is line-ending unification: CRLF (`\r\n`) and lone CR
 * (`\r`) both become LF (`\n`). Interior content is NOT trimmed and whitespace
 * is otherwise preserved, so character offsets computed against the normalized
 * text are stable regardless of the authoring platform. This is what makes a
 * CRLF file and its LF twin hash identically and anchor identically.
 */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/** Lowercase hex sha256 of a UTF-8 string, via node:crypto. */
function sha256hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Content hash of normalized text: `"sha256:" + sha256hex(normalized)`. Stable
 * and prefixed so downstream consumers can see the algorithm.
 */
export function contentHash(normalizedText: string): string {
  return `sha256:${sha256hex(normalizedText)}`
}

/**
 * Deterministic asset id derived from the content hash (NOT time-based): the
 * first 12 hex chars of the digest, prefixed `src-`. Same content ⇒ same id.
 */
export function deriveSourceId(normalizedText: string): string {
  const hex = sha256hex(normalizedText)
  return `src-${hex.slice(0, 12)}`
}

// --- Segmentation -----------------------------------------------------------

/** A half-open character span `[start, end)` into the normalized text. */
interface Span {
  start: number
  end: number
}

/**
 * Segment normalized text into SENTENCE spans (bd-17).
 *
 * SEGMENTATION DECISION (documented per bd-17, issue #4): we keep the outer
 * blank-line PARAGRAPH split as structure, then split each paragraph into
 * SENTENCES, so a multi-sentence source now yields one anchor PER sentence (the
 * finer-grained provenance the operator chose over bd-5's paragraph anchoring).
 *
 * Paragraph boundary: a run of one-or-more blank/whitespace-only lines (2+
 * newlines). A sentence boundary NEVER crosses a paragraph boundary — each
 * paragraph block is segmented independently.
 *
 * Sentence-boundary HEURISTIC (deterministic, language-agnostic): inside a
 * paragraph block, a boundary occurs at a sentence-ending char `[.!?]` —
 * allowing trailing closing quotes/brackets `["')\]]*` — that is FOLLOWED BY
 * whitespace and then a non-whitespace char, OR at the end of the paragraph
 * block. Because a boundary requires whitespace after the terminator, decimals
 * like `3.14` (where `.` is followed by a digit, not whitespace) do NOT split.
 *
 * KNOWN LIMITATION (accepted, no over-engineering): abbreviations such as
 * `e.g.`, `i.e.`, `Dr.`, `etc.` are followed by whitespace + a letter, so this
 * heuristic OVER-SPLITS them into separate sentences. This is a deliberately
 * accepted trade-off — we do NOT carry an abbreviation dictionary or any
 * locale-specific tables. The anchors remain exact and verifiable regardless;
 * only the granularity differs at those rare points.
 *
 * Each emitted span is trimmed to a tight (leading/trailing-whitespace-free)
 * span, so the excerpt is the exact `normalized.slice(start,end)` with no
 * surrounding whitespace. Interior whitespace/newlines are preserved verbatim.
 * Offsets are computed by scanning the normalized string directly, so they
 * never drift from `normalized.slice`. Whitespace-only spans are skipped
 * entirely (no anchor is emitted for them).
 */
function segmentSentences(normalized: string): Span[] {
  const spans: Span[] = []
  // Trim a [rawStart,rawEnd) range to a tight span and push it if non-empty.
  const pushTrimmed = (rawStart: number, rawEnd: number): void => {
    let s = rawStart
    let e = rawEnd
    while (s < e && /\s/.test(normalized[s]!)) s++
    while (e > s && /\s/.test(normalized[e - 1]!)) e--
    if (e > s) spans.push({ start: s, end: e })
  }

  // Split a [blockStart,blockEnd) PARAGRAPH block into sentence spans. The
  // sentence-terminator regex is anchored within the block only, so a boundary
  // can never cross into the next paragraph.
  const segmentBlock = (blockStart: number, blockEnd: number): void => {
    // Match a terminator [.!?], optional closing quotes/brackets, then the
    // whitespace run, then look-ahead at the following non-whitespace char. The
    // whitespace is consumed by the match so the next sentence starts at the
    // following non-whitespace char (the trim() below handles it either way).
    const boundaryRe = /[.!?]["')\]]*\s+(?=\S)/g
    boundaryRe.lastIndex = 0
    let cursor = blockStart
    let m: RegExpExecArray | null
    // Restrict matching to this block by slicing-by-index: scan the whole
    // normalized string but stop once a match starts at/after blockEnd.
    const block = normalized.slice(blockStart, blockEnd)
    while ((m = boundaryRe.exec(block)) !== null) {
      // Absolute end of this sentence = block-relative match index + the length
      // of the terminator+closers (i.e. up to, but excluding, the whitespace).
      const termLen = m[0].length - (m[0].match(/\s+$/)?.[0].length ?? 0)
      const sentenceEnd = blockStart + m.index + termLen
      pushTrimmed(cursor, sentenceEnd)
      cursor = blockStart + boundaryRe.lastIndex
    }
    // Trailing sentence (or the whole block if it had no internal boundary):
    // ends at the paragraph end.
    pushTrimmed(cursor, blockEnd)
  }

  // Outer paragraph split on one-or-more blank lines, tracking offsets manually
  // so spans index back into `normalized` exactly.
  const blankRunRe = /\n[ \t]*(?:\n[ \t]*)*\n/g // 2+ newlines (a blank line) = boundary
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = blankRunRe.exec(normalized)) !== null) {
    segmentBlock(cursor, match.index)
    cursor = match.index + match[0].length
  }
  // Trailing paragraph block after the last boundary.
  segmentBlock(cursor, normalized.length)
  return spans
}

// --- Anchoring + verification -----------------------------------------------

/**
 * Re-derive an anchor's excerpt from its selector and compare to the stored
 * excerpt.
 *
 * VERIFIABLE TOLERANCE (documented per bd-5): EXACT equality. The selector's
 * character offsets are authoritative; `verifiable` is true iff
 * `normalizedText.slice(Number(start), Number(end)) === anchor.excerpt`,
 * byte-for-byte (===, including all whitespace). Nothing is tolerated — no
 * trimming, no case-folding, no whitespace collapsing. By construction every
 * anchor this package emits satisfies this (the excerpt IS that slice), so all
 * emitted anchors are `verifiable: true`. Selectors with non-numeric offsets or
 * `start > end` re-derive to a value that will not match, yielding `false`.
 */
export function verifyAnchor(
  anchor: SourceAnchor,
  normalizedText: string,
): boolean {
  const start = Number(anchor.selector.start)
  const end = Number(anchor.selector.end)
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false
  if (start < 0 || end < start || end > normalizedText.length) return false
  return normalizedText.slice(start, end) === anchor.excerpt
}

/**
 * Build a `SourceAnchor` for a span. The id encodes the offsets
 * (`anc-<start>-<end>`) so it is deterministic and collision-free across
 * distinct spans within one source.
 */
function buildAnchor(
  sourceAssetId: string,
  normalized: string,
  span: Span,
): SourceAnchor {
  const excerpt = normalized.slice(span.start, span.end)
  const anchor: SourceAnchor = {
    id: `anc-${span.start}-${span.end}`,
    source_asset_id: sourceAssetId,
    selector: {
      kind: 'text_quote',
      start: String(span.start),
      end: String(span.end),
    },
    excerpt,
    extraction_method: 'native',
    // Set from the re-derivation check rather than hardcoded true, so the field
    // means what it says (a check, not a claim). True by construction here.
    verifiable: false,
  }
  anchor.verifiable = verifyAnchor(anchor, normalized)
  return anchor
}

// --- Entry point ------------------------------------------------------------

const DEFAULT_NOW = (): Date => new Date()
const DEFAULT_ACTOR: DerivationActor = 'ai'

/**
 * Ingest a single text/markdown source into a `SourceAsset`, its verifiable
 * `SourceAnchor`s, and an `ingest` `DerivationRun`.
 *
 * Returns a Promise for signature compatibility, but all data is derived
 * synchronously (no network, no fs). Determinism: same `request.content` + same
 * `opts.now` ⇒ deeply-equal result.
 *
 * @throws UnsupportedMediaTypeError if `media_type` is not markdown/text.
 */
export function ingestSource(
  request: IngestRequest,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const { media_type } = request
  // Allowlist guard: only text-shaped sources have a native, re-derivable
  // character-offset model. Everything else (video/audio/pdf/html/…) is rejected.
  if (media_type !== 'markdown' && media_type !== 'text') {
    throw new UnsupportedMediaTypeError(String(media_type))
  }

  const now = opts.now ?? DEFAULT_NOW
  const actor = opts.actor ?? DEFAULT_ACTOR

  const normalized = normalizeText(request.content)
  const sourceId = deriveSourceId(normalized)

  const source: SourceAsset = {
    id: sourceId,
    uri: request.uri,
    media_type: request.media_type,
    title: request.title,
    ...(request.creator !== undefined ? { creator: request.creator } : {}),
    license: request.license,
    access: request.access,
    content_hash: contentHash(normalized),
  }

  const anchors = segmentSentences(normalized).map((span) =>
    buildAnchor(sourceId, normalized, span),
  )

  const derivation: DerivationRun = {
    // Deterministic id tied to the source so re-ingesting the same content with
    // the same clock yields the same derivation id.
    id: `der-ingest-${sourceId}`,
    op: 'ingest',
    input_ids: [sourceId],
    output_ids: anchors.map((a) => a.id),
    actor,
    schema_version: '0',
    // toISOString() is always UTC `Z`-suffixed → timezone-aware (validator bd-4).
    created_at: now().toISOString(),
  }

  return Promise.resolve({ source, anchors, derivation })
}
