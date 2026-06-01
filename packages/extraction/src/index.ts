/**
 * @sam/extraction — pluggable source->atoms/anchors extraction (STUB).
 *
 * Two adapters share one interface (D-006):
 *  - MockExtractionAdapter: deterministic, zero-cost. Backs all tests + the
 *    offline alpha demo. Implemented here.
 *  - OpenAI adapter: bd-6 adds it (and the `openai` dependency). Env-configured,
 *    fail-loud, NO hardcoded model default — `OPENAI_MODEL` is required.
 *
 * `getAdapter(env)` is the factory the server uses to pick one at runtime.
 */
import type { Atom, SourceAnchor, Cost } from '@sam/types'

/** A source to extract from. Real shape (with content) is finalized in bd-6. */
export interface ExtractionInput {
  source_asset_id: string
  /** Plain text / transcript the adapter reasons over. */
  text: string
}

/** Pure result of an extraction pass: candidate atoms, anchors, and the cost. */
export interface ExtractionResult {
  atoms: Atom[]
  anchors: SourceAnchor[]
  cost: Cost
}

/** The contract every extraction backend implements. */
export interface ExtractionAdapter {
  /** Stable identifier for logging/provenance (e.g. "mock", "openai"). */
  readonly name: string
  extract(input: ExtractionInput): Promise<ExtractionResult>
}

/**
 * Deterministic, zero-cost adapter. Returns an empty extraction for now; bd-6
 * may extend the mock to emit fixture atoms for the offline demo. Crucially it
 * never fabricates cost — usd/tokens are zero.
 */
export class MockExtractionAdapter implements ExtractionAdapter {
  readonly name = 'mock'

  extract(input: ExtractionInput): Promise<ExtractionResult> {
    void input
    return Promise.resolve({
      atoms: [],
      anchors: [],
      cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
    })
  }
}

/** Subset of process.env the factory reads. Kept explicit for testability. */
export interface AdapterEnv {
  /** Selects the backend. Anything other than "openai" -> mock. */
  EXTRACTION_ADAPTER?: string
  OPENAI_API_KEY?: string
  /** Required for the OpenAI adapter — there is NO default model (D-006). */
  OPENAI_MODEL?: string
  OPENAI_BASE_URL?: string
}

/**
 * Pick an extraction adapter from the environment.
 *
 * STUB: returns the mock for everything. When `EXTRACTION_ADAPTER=openai`, bd-6
 * will construct the OpenAI adapter (and validate that OPENAI_API_KEY +
 * OPENAI_MODEL are present, throwing if not). Until then we fail loud rather
 * than silently downgrade, so a misconfigured "openai" request is caught.
 */
export function getAdapter(env: AdapterEnv = {}): ExtractionAdapter {
  if (env.EXTRACTION_ADAPTER === 'openai') {
    throw new Error(
      'OpenAI extraction adapter is not implemented yet (bd-6); set EXTRACTION_ADAPTER=mock or leave it unset.',
    )
  }
  return new MockExtractionAdapter()
}
