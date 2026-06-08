/**
 * @sam/extraction — pluggable source -> DRAFT atoms/relationships extraction.
 *
 * Two adapters share one interface (D-006):
 *  - {@link MockExtractionAdapter}: deterministic, zero network, zero cost.
 *    Backs all tests + the offline alpha demo (bd-10). Implemented in
 *    `mock-adapter.ts`.
 *  - {@link OpenAIAdapter}: env-configured, fail-loud, NO hardcoded model
 *    default (`OPENAI_MODEL` is required). Implemented in `openai-adapter.ts`,
 *    which is the ONLY module that imports the `openai` SDK — and it imports it
 *    lazily inside `extract()`, so neither the mock path NOR merely constructing
 *    the OpenAI adapter (to validate env) loads the SDK.
 *
 * `getAdapter(env)` is the factory the server (bd-7) uses to pick one at
 * runtime.
 *
 * Extraction does NOT invent anchors (bd-5 owns anchors). It is handed the
 * EXISTING anchors via `ExtractionInput.anchors` and may only reference those
 * ids. It emits DRAFT content: atoms/relationships with
 * `review_state: "generated"` and `authored_by: "ai"`, plus an `extract`
 * `DerivationRun` carrying the cost the probe needs (`usd_per_published_atom`).
 */
import type {
  Atom,
  DerivationRun,
  Relationship,
  SourceAnchor,
} from '@sam/types'

import { MockExtractionAdapter } from './mock-adapter.js'
import { OpenAIAdapter } from './openai-adapter.js'

// --- Public types -----------------------------------------------------------

/**
 * What an adapter is asked to extract from.
 *
 * `anchors` are the EXISTING bd-5 anchors for `source_asset_id`. Extraction
 * references only ids present here; it never fabricates anchors (bd-5 owns
 * anchors). `text` is the normalized source text the adapter reasons over (the
 * server reads files and passes content; this package is filesystem-free,
 * D-007).
 */
export interface ExtractionInput {
  source_asset_id: string
  /** Normalized source text / transcript the adapter reasons over. */
  text: string
  /** The existing anchors for the source. Atoms may reference only these ids. */
  anchors: SourceAnchor[]
  /**
   * Optional clock for the extract derivation's `created_at`. When set it takes
   * precedence over the adapter's own clock, so a caller (e.g. the server) can
   * thread ONE deterministic clock through the whole data path. Adapters resolve
   * the clock as `input.now ?? this.now ?? defaultNow`.
   */
  now?: () => Date
}

/**
 * Pure result of an extraction pass: DRAFT atoms + relationships and the
 * `extract` derivation that produced them. Cost lives on `derivation.cost`
 * (there is intentionally no top-level `cost`/`anchors`: anchors come from the
 * input, cost is provenance).
 */
export interface ExtractionResult {
  atoms: Atom[]
  relationships: Relationship[]
  derivation: DerivationRun
}

/** The contract every extraction backend implements. */
export interface ExtractionAdapter {
  /** Stable identifier for logging/provenance (e.g. "mock", "openai"). */
  readonly name: string
  extract(input: ExtractionInput): Promise<ExtractionResult>
}

/**
 * Subset of `process.env` the factory reads. Kept explicit (not `process.env`)
 * so callers and tests pass exactly what they mean.
 */
export interface AdapterEnv {
  /** Selects the backend. `"openai"` -> OpenAI adapter; anything else -> mock. */
  EXTRACTION_ADAPTER?: string
  OPENAI_API_KEY?: string
  /** Required for the OpenAI adapter — there is NO default model (D-006). */
  OPENAI_MODEL?: string
  OPENAI_BASE_URL?: string
}

// --- Re-exports -------------------------------------------------------------

export { MockExtractionAdapter } from './mock-adapter.js'
export type { MockExtractionOptions } from './mock-adapter.js'
export { OpenAIAdapter, OPENAI_PRICE_MAP } from './openai-adapter.js'
export type { OpenAIAdapterOptions } from './openai-adapter.js'

// --- Factory ----------------------------------------------------------------

/**
 * Pick an extraction adapter from the environment.
 *
 * - `EXTRACTION_ADAPTER === "openai"` constructs the OpenAI adapter, which
 *   validates its env (`OPENAI_API_KEY` + `OPENAI_MODEL` required) and THROWS a
 *   clear error if misconfigured — we fail loud rather than silently downgrade
 *   to the mock, so a misconfigured "openai" request is caught at startup. The
 *   `openai` SDK is still not loaded here: it is imported lazily inside the
 *   adapter's `extract()`.
 * - anything else (unset, `"mock"`, ...) returns the deterministic mock.
 */
export function getAdapter(env: AdapterEnv = {}): ExtractionAdapter {
  if (env.EXTRACTION_ADAPTER === 'openai') {
    return new OpenAIAdapter({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      baseURL: env.OPENAI_BASE_URL,
    })
  }
  return new MockExtractionAdapter()
}
