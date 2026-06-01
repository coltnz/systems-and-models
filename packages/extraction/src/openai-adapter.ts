/**
 * OpenAIAdapter — env-configured, fail-loud OpenAI extraction (D-006).
 *
 * This is the ONLY module that touches the `openai` SDK, and it imports it
 * LAZILY (a dynamic `import("openai")` inside `extract()`). Consequences:
 *   - the mock path never loads the SDK;
 *   - merely CONSTRUCTING this adapter (to validate env / fail loud at startup)
 *     does not load the SDK either — only an actual `extract()` call does.
 *
 * Env contract (no hardcoded model default — D-006):
 *   - `OPENAI_API_KEY`  (required; throws if absent)
 *   - `OPENAI_MODEL`    (required; throws if absent — NO default model)
 *   - `OPENAI_BASE_URL` (optional)
 *
 * The model is constrained with structured output
 * (`response_format: { type: "json_schema", strict: true, ... }`) to the DRAFT
 * atom/relationship shape and its JSON is parsed defensively. Cost is captured
 * from `response.usage` (`tokens_in=prompt_tokens`, `tokens_out=completion_tokens`)
 * and `usd` is computed from a small DOCUMENTED price map keyed by model, falling
 * back to `usd: 0` if the model is unknown (never fabricated).
 */
import { createHash } from 'node:crypto'

import type { AtomKind, Cost, Predicate, SupportState } from '@sam/types'

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

// --- Price map (DOCUMENTED) -------------------------------------------------

/**
 * USD price per 1,000,000 tokens, keyed by model name, for `usd` cost capture.
 *
 * DOCUMENTED + intentionally small: these are list prices for a few common
 * OpenAI models (USD per 1M tokens, input/output) as published by OpenAI. They
 * are used ONLY to fill `DerivationRun.cost.usd`. If the configured model is not
 * in this map we record `usd: 0` rather than fabricate a number (D-006: silent
 * model swaps must not corrupt the `usd_per_published_atom` metric — a 0 is an
 * honest "unknown", a guess is not). Keep this list short and update it
 * deliberately when adding a model to the env.
 */
export const OPENAI_PRICE_MAP: Readonly<
  Record<string, { inputPerMTok: number; outputPerMTok: number }>
> = {
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  'gpt-4.1': { inputPerMTok: 2, outputPerMTok: 8 },
  'gpt-4.1-mini': { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  'gpt-4.1-nano': { inputPerMTok: 0.1, outputPerMTok: 0.4 },
}

/**
 * Compute USD from token usage and the model's list price. Returns 0 (never
 * fabricated) when the model is unknown. Rounded to 6 dp to avoid float noise in
 * provenance.
 */
export function computeUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const price = OPENAI_PRICE_MAP[model]
  if (!price) return 0
  const usd =
    (tokensIn / 1_000_000) * price.inputPerMTok +
    (tokensOut / 1_000_000) * price.outputPerMTok
  return Math.round(usd * 1e6) / 1e6
}

// --- Options + env validation -----------------------------------------------

export interface OpenAIAdapterOptions {
  apiKey?: string
  /** The model id. Required — there is NO default (D-006). */
  model?: string
  baseURL?: string
  /**
   * Clock for the derivation's `created_at`. Injected for determinism in tests.
   * Defaults to `() => new Date()`.
   */
  now?: () => Date
}

const DEFAULT_NOW = (): Date => new Date()

/** Thrown when required OpenAI env/config is missing. Names the missing var. */
export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenAIConfigError'
  }
}

// --- The JSON schema the model must emit ------------------------------------

const ATOM_KINDS: AtomKind[] = ['system', 'model', 'claim']
const PREDICATES: Predicate[] = [
  'uses',
  'requires',
  'explains',
  'supports',
  'contradicts',
]
const SUPPORT_STATES: SupportState[] = [
  'supports',
  'partially',
  'does_not_support',
  'disputed',
]

/**
 * Build the structured-output JSON schema for one extraction call. The anchor
 * ids are constrained to the EXACT input anchor ids via `enum`, so the model is
 * structurally prevented from inventing anchors. We still re-check in
 * `assembleExtraction` (defense in depth).
 */
function buildResponseSchema(anchorIds: string[]): Record<string, unknown> {
  // `enum` cannot be empty; when there are no anchors the caller short-circuits
  // before building a schema, so anchorIds is always non-empty here.
  const anchorIdSchema = { type: 'string', enum: anchorIds }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['atoms', 'relationships'],
    properties: {
      atoms: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'kind', 'title', 'summary', 'body', 'anchors'],
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ATOM_KINDS },
            title: { type: 'string' },
            summary: { type: 'string' },
            body: { type: 'string' },
            anchors: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['anchor_id', 'support_state'],
                properties: {
                  anchor_id: anchorIdSchema,
                  support_state: { type: 'string', enum: SUPPORT_STATES },
                },
              },
            },
          },
        },
      },
      relationships: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'from_atom_id',
            'to_atom_id',
            'predicate',
            'anchor_ids',
            'support_state',
          ],
          properties: {
            id: { type: 'string' },
            from_atom_id: { type: 'string' },
            to_atom_id: { type: 'string' },
            predicate: { type: 'string', enum: PREDICATES },
            anchor_ids: { type: 'array', items: anchorIdSchema },
            support_state: { type: 'string', enum: SUPPORT_STATES },
          },
        },
      },
    },
  }
}

// --- Prompt -----------------------------------------------------------------

function buildSystemPrompt(): string {
  return [
    'You extract DRAFT learning content from a source transcript.',
    'Emit atoms (kind: system|model|claim) and relationships between them.',
    'Every atom anchor_id and every relationship anchor_id MUST be one of the',
    'provided anchor ids — never invent anchors. Propose a support_state for',
    'each anchor reference; a human reviewer confirms it later. Keep titles',
    'short. Output strictly matches the provided JSON schema.',
  ].join(' ')
}

function buildUserPrompt(input: ExtractionInput): string {
  const anchorLines = input.anchors
    .map((a) => `- ${a.id}: ${JSON.stringify(a.excerpt)}`)
    .join('\n')
  return [
    `source_asset_id: ${input.source_asset_id}`,
    '',
    'Available anchors (id: excerpt):',
    anchorLines,
    '',
    'Full source text:',
    input.text,
  ].join('\n')
}

// --- Defensive parsing of the model output ----------------------------------

interface RawDraft {
  atoms: unknown
  relationships: unknown
}

function asRecord(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`OpenAI extraction: expected an object at ${where}`)
  }
  return v as Record<string, unknown>
}

function asString(v: unknown, where: string): string {
  if (typeof v !== 'string') {
    throw new Error(`OpenAI extraction: expected a string at ${where}`)
  }
  return v
}

function asArray(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) {
    throw new Error(`OpenAI extraction: expected an array at ${where}`)
  }
  return v
}

function parseDraft(content: string): DraftBundle {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI extraction: model did not return valid JSON')
  }
  const root = asRecord(parsed, 'root') as unknown as RawDraft

  const atoms: DraftAtom[] = asArray(root.atoms, 'atoms').map((raw, i) => {
    const o = asRecord(raw, `atoms[${i}]`)
    const kind = asString(o.kind, `atoms[${i}].kind`) as AtomKind
    const anchors = asArray(o.anchors, `atoms[${i}].anchors`).map((aRaw, j) => {
      const a = asRecord(aRaw, `atoms[${i}].anchors[${j}]`)
      return {
        anchor_id: asString(a.anchor_id, `atoms[${i}].anchors[${j}].anchor_id`),
        support_state: asString(
          a.support_state,
          `atoms[${i}].anchors[${j}].support_state`,
        ) as SupportState,
      }
    })
    return {
      id: asString(o.id, `atoms[${i}].id`),
      kind,
      title: asString(o.title, `atoms[${i}].title`),
      summary: asString(o.summary, `atoms[${i}].summary`),
      body: asString(o.body, `atoms[${i}].body`),
      anchors,
    }
  })

  const relationships: DraftRelationship[] = asArray(
    root.relationships,
    'relationships',
  ).map((raw, i) => {
    const o = asRecord(raw, `relationships[${i}]`)
    const anchor_ids = asArray(
      o.anchor_ids,
      `relationships[${i}].anchor_ids`,
    ).map((id, j) => asString(id, `relationships[${i}].anchor_ids[${j}]`))
    return {
      id: asString(o.id, `relationships[${i}].id`),
      from_atom_id: asString(o.from_atom_id, `relationships[${i}].from_atom_id`),
      to_atom_id: asString(o.to_atom_id, `relationships[${i}].to_atom_id`),
      predicate: asString(o.predicate, `relationships[${i}].predicate`) as Predicate,
      anchor_ids,
      support_state: asString(
        o.support_state,
        `relationships[${i}].support_state`,
      ) as SupportState,
    }
  })

  return { atoms, relationships }
}

// --- Minimal structural view of the OpenAI SDK we depend on -----------------
//
// Typed locally so this file does not need the `openai` types at compile time
// (the SDK is a runtime-only, lazily-imported dependency). Only the fields we
// read are modeled.

interface OpenAIUsage {
  prompt_tokens?: number
  completion_tokens?: number
}
interface OpenAIChoiceMessage {
  content?: string | null
}
interface OpenAIChoice {
  message?: OpenAIChoiceMessage
}
interface OpenAIResponse {
  model?: string
  usage?: OpenAIUsage
  choices?: OpenAIChoice[]
}
interface OpenAIChatCompletions {
  create(body: unknown): Promise<OpenAIResponse>
}
interface OpenAIClient {
  chat: { completions: OpenAIChatCompletions }
}
interface OpenAIModule {
  default: new (opts: { apiKey: string; baseURL?: string }) => OpenAIClient
}

// --- Adapter ----------------------------------------------------------------

export class OpenAIAdapter implements ExtractionAdapter {
  readonly name = 'openai'

  private readonly apiKey: string
  private readonly model: string
  private readonly baseURL?: string
  private readonly now: () => Date

  /**
   * Validates env up front (D-006: fail loud). Throws {@link OpenAIConfigError}
   * naming the missing var if `apiKey` or `model` is absent. Does NOT load the
   * `openai` SDK (that happens lazily in `extract`).
   */
  constructor(opts: OpenAIAdapterOptions) {
    if (!opts.apiKey) {
      throw new OpenAIConfigError(
        'OpenAI extraction adapter requires OPENAI_API_KEY (it is missing or empty).',
      )
    }
    if (!opts.model) {
      throw new OpenAIConfigError(
        'OpenAI extraction adapter requires OPENAI_MODEL — there is no default model (D-006). ' +
          'Set OPENAI_MODEL to the model id you want to use.',
      )
    }
    this.apiKey = opts.apiKey
    this.model = opts.model
    this.baseURL = opts.baseURL
    this.now = opts.now ?? DEFAULT_NOW
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const derivationId = `der-extract-${input.source_asset_id}`
    const validAnchorIds = new Set(input.anchors.map((a) => a.id))
    const createdAt = this.now().toISOString()

    // With no anchors there is nothing to ground a draft on; return an empty
    // (but valid) extraction without calling the API or fabricating cost.
    if (input.anchors.length === 0) {
      return assembleExtraction({
        sourceAssetId: input.source_asset_id,
        derivationId,
        validAnchorIds,
        draft: { atoms: [], relationships: [] },
        cost: { tokens_in: 0, tokens_out: 0, usd: 0 },
        createdAt,
        derivationExtras: { model_name: this.model },
      })
    }

    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(input)
    const promptHash = sha256hex(`${systemPrompt}\n\n${userPrompt}`)
    const schema = buildResponseSchema(input.anchors.map((a) => a.id))

    // Lazily load the SDK so it stays off the mock path. Dynamic import keeps
    // this ESM/NodeNext-clean.
    const mod = (await import('openai')) as unknown as OpenAIModule
    const OpenAI = mod.default
    const client = new OpenAI({
      apiKey: this.apiKey,
      ...(this.baseURL !== undefined ? { baseURL: this.baseURL } : {}),
    })

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'extraction_draft',
          strict: true,
          schema,
        },
      },
    })

    const content = response.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('OpenAI extraction: response had no message content')
    }
    const draft = parseDraft(content)

    const tokensIn = response.usage?.prompt_tokens ?? 0
    const tokensOut = response.usage?.completion_tokens ?? 0
    const cost: Cost = {
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      usd: computeUsd(this.model, tokensIn, tokensOut),
    }

    return assembleExtraction({
      sourceAssetId: input.source_asset_id,
      derivationId,
      validAnchorIds,
      draft,
      cost,
      createdAt,
      derivationExtras: {
        model_name: this.model,
        // `response.model` is the resolved snapshot (e.g. gpt-4o-2024-08-06).
        ...(response.model !== undefined
          ? { model_snapshot: response.model }
          : {}),
        prompt_hash: promptHash,
      },
    })
  }
}

function sha256hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
