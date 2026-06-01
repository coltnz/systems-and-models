/**
 * @sam/ingest — turn a raw source into a stored SourceAsset + anchors (STUB).
 *
 * bd-5 implements this for real: fetch/normalize a source, compute a content
 * hash, extract verifiable anchors (ASR/native/OCR), and return pure data. Per
 * D-007 this package is filesystem-free — `@sam/server` persists the result.
 */
import type { SourceAsset, SourceAnchor } from '@sam/types'

/** What the caller hands us to ingest. The real shape is finalized in bd-5. */
export interface IngestRequest {
  uri: string
  media_type: SourceAsset['media_type']
  title: string
  license: string
  access: SourceAsset['access']
}

/** Pure result of ingestion: the asset plus its verifiable anchors. */
export interface IngestResult {
  source: SourceAsset
  anchors: SourceAnchor[]
}

/**
 * Ingest a single source.
 *
 * STUB (bd-5): not implemented yet. Throws so accidental use in the alpha fails
 * loudly rather than silently returning fake data.
 */
export function ingestSource(request: IngestRequest): Promise<IngestResult> {
  void request
  throw new Error('ingestSource is not implemented yet (bd-5)')
}
