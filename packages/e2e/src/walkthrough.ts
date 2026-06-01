/**
 * @sam/e2e — the scripted alpha walkthrough (bd-10).
 *
 * Proves the WHOLE alpha loop end-to-end, OFFLINE and REPRODUCIBLY, by driving
 * the REAL server request core (`createServer(...).handle`) — the same code path
 * the web UI (bd-8) hits over HTTP — with the default MOCK adapter and INJECTED
 * `now`/`idFactory` for determinism. No network, no API key.
 *
 * The alpha goal sentence, made executable:
 *   a user supplies transcript/Markdown
 *     -> generates a draft Learning Pack (mock adapter)   [POST /sources, /packs/draft]
 *     -> validates                                        [draft validation.ok]
 *     -> reviews/edits                                    [set_support, accept, reject]
 *     -> saves a reviewed pack                            [POST /packs/:id/reviewed -> 201]
 *     -> asks a grounded tutor question that cites        [POST /tutor/query in-scope]
 *        reviewed anchors or refuses.                     [POST /tutor/query out-of-scope]
 *
 * This module is the single source of truth for the flow: the Vitest test
 * (`walkthrough.test.ts`) asserts each step, and the runnable demo (`demo.ts`)
 * re-runs it to emit the committed example artifacts. Both share one fixed clock
 * and id sequence, so the generated draft + reviewed packs are byte-stable.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MockExtractionAdapter } from '@sam/extraction'
import { createServer, type ApiResponse, type LearningPack, type Server } from '@sam/server'

// --- Demo source -------------------------------------------------------------

/** Filename of the committed, original, CC-BY-4.0 demo transcript. */
export const DEMO_FIXTURE = 'circuit-breaker.md'

/** Path to the committed demo fixture, relative to this module (src or dist). */
function fixturePath(): string {
  // This module lives in `src/` (Vitest, via D-011 aliases) or `dist/` (built
  // demo). `fixtures/` sits one level up from either, at the package root.
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', 'fixtures', DEMO_FIXTURE)
}

/**
 * Read the demo transcript and strip its leading license/header HTML comment so
 * the text we ingest is the body only. The CC-BY-4.0 license travels separately
 * in the source metadata (`license` field below), which is where the schema and
 * server expect it — keeping the ingested anchors clean of the header.
 */
export function loadDemoSource(): string {
  const raw = readFileSync(fixturePath(), 'utf8')
  return raw.replace(/^<!--[\s\S]*?-->\s*/, '')
}

// --- Determinism harness -----------------------------------------------------

/** Fixed, tz-aware clock so every `created_at`/`saved_at` is stable & valid. */
export const FIXED_NOW = (): Date => new Date('2026-06-01T12:00:00.000Z')

/** Sequential, predictable id factory for server-minted ids (pack/edit ids). */
export function seqIds(): () => string {
  let n = 0
  return () => `id-${++n}`
}

/**
 * Build a server bound to `dataDir` with the injected clock + id sequence and a
 * clock-injected MOCK adapter. This is the same default mock the server uses
 * offline (`getAdapter(process.env)` with no `OPENAI_*` set === mock), but with
 * `FIXED_NOW` threaded into the adapter so the `extract` derivation's
 * `created_at` is deterministic too — making the committed example packs
 * byte-stable on every run.
 */
export function newDemoServer(dataDir: string): Server {
  return createServer({
    dataDir,
    now: FIXED_NOW,
    idFactory: seqIds(),
    adapter: new MockExtractionAdapter({ now: FIXED_NOW }),
  })
}

// --- Walkthrough result ------------------------------------------------------

/** A tutor result as returned by `POST /tutor/query`. */
export type TutorResult =
  | { kind: 'answer'; text: string; citations: { atom_id: string; anchor_id: string; excerpt: string }[] }
  | { kind: 'refusal'; reason: string }

/** Everything the walkthrough produced — assertable by the test, dumpable by the demo. */
export interface WalkthroughResult {
  sourceId: string
  anchorCount: number
  packId: string
  /** The draft pack exactly as returned by `POST /packs/draft`. */
  draftPack: LearningPack
  draftValidationOk: boolean
  /** The reviewed snapshot pack saved by `POST /packs/:id/reviewed`. */
  reviewedPack: LearningPack
  reviewedSavedAt: string
  /** Id of the model atom we reviewed + intend the tutor to cite. */
  modelAtomId: string
  inScopeQuestion: string
  inScope: TutorResult
  outOfScopeQuestion: string
  outOfScope: TutorResult
}

// --- The scripted flow -------------------------------------------------------

function body<T>(res: ApiResponse): T {
  return res.body as T
}

/** In-scope: overlaps the model atom (circuit-breaker paragraph = anchor[0]). */
export const IN_SCOPE_QUESTION = 'What is the circuit breaker pattern and when does it open?'
/** Out-of-scope: zero content-token overlap with the reviewed graph. */
export const OUT_OF_SCOPE_QUESTION = 'How does photosynthesis convert sunlight into sugar in plants?'

/**
 * Run the full alpha loop against a real server core over `dataDir`. Pure with
 * respect to determinism: same `dataDir` (fresh) + same fixed clock/ids ⇒
 * byte-identical draft and reviewed packs. Throws (with a clear message) the
 * moment any step deviates from the alpha contract, so both the test and the
 * demo fail loudly rather than emitting a wrong artifact.
 */
export async function runWalkthrough(dataDir: string): Promise<WalkthroughResult> {
  const server = newDemoServer(dataDir)

  // 1. Supply transcript/Markdown -> ingest into a source + verifiable anchors.
  const srcRes = await server.handle({
    method: 'POST',
    path: '/sources',
    body: {
      title: 'The Circuit Breaker Pattern for Resilient Services',
      creator: 'Systems & Models project',
      media_type: 'markdown',
      license: 'CC-BY-4.0',
      access: 'open',
      content: loadDemoSource(),
    },
  })
  expect(srcRes.status, 201, 'POST /sources should create the source')
  const src = body<{ source_id: string; anchors: { id: string }[] }>(srcRes)
  if (src.anchors.length < 2) {
    throw new Error(`expected >=2 anchors from the demo source, got ${src.anchors.length}`)
  }

  // 2. Generate a draft Learning Pack from the source (mock adapter) + validate.
  const draftRes = await server.handle({
    method: 'POST',
    path: '/packs/draft',
    body: { source_id: src.source_id },
  })
  expect(draftRes.status, 201, 'POST /packs/draft should create the draft pack')
  const draft = body<{ pack_id: string; pack: LearningPack; validation: { ok: boolean } }>(draftRes)
  if (!draft.validation.ok) throw new Error('draft pack failed validation')
  if (draft.pack.atoms.length < 1) throw new Error('draft pack has no atoms')

  // The mock anchors the MODEL atom to anchor[0] with support_state="supports".
  const modelAtom = draft.pack.atoms.find((a) => a.kind === 'model')
  if (!modelAtom) throw new Error('draft pack has no model atom to cite')
  const modelAnchorId = modelAtom.anchors[0]?.anchor_id
  if (!modelAnchorId) throw new Error('model atom has no anchor to support')

  // 3. Review. Confirm the model atom's supporting anchor (mock proposes it;
  //    the human ratifies it), then ACCEPT the model atom -> reviewed.
  const setSupport = await server.handle({
    method: 'PATCH',
    path: `/packs/${draft.pack_id}/atoms/${modelAtom.id}`,
    body: { op: 'set_support', anchor_id: modelAnchorId, support_state: 'supports' },
  })
  expect(setSupport.status, 200, 'set_support on the model anchor should succeed')

  const accept = await server.handle({
    method: 'PATCH',
    path: `/packs/${draft.pack_id}/atoms/${modelAtom.id}`,
    body: { op: 'accept' },
  })
  expect(accept.status, 200, 'accepting the model atom should succeed')

  // Handle the OTHER atoms: reject them (the mock's claim atom is "partially"
  // supported; rejecting keeps the reviewed graph tight and tests the reject op).
  for (const atom of draft.pack.atoms) {
    if (atom.id === modelAtom.id) continue
    const rej = await server.handle({
      method: 'PATCH',
      path: `/packs/${draft.pack_id}/atoms/${atom.id}`,
      body: { op: 'reject' },
    })
    expect(rej.status, 200, `rejecting atom ${atom.id} should succeed`)
  }

  // 4. Save a reviewed pack snapshot (must be fully valid -> 201).
  const reviewedRes = await server.handle({
    method: 'POST',
    path: `/packs/${draft.pack_id}/reviewed`,
  })
  expect(reviewedRes.status, 201, 'POST /packs/:id/reviewed should save the snapshot (201)')
  const reviewed = body<{ reviewed: { pack: LearningPack; saved_at: string } }>(reviewedRes)

  // 5a. In-scope tutor question -> grounded answer citing the reviewed anchor.
  const inScopeRes = await server.handle({
    method: 'POST',
    path: '/tutor/query',
    body: { pack_id: draft.pack_id, question: IN_SCOPE_QUESTION },
  })
  expect(inScopeRes.status, 200, 'in-scope tutor query should return 200')
  const inScope = body<{ result: TutorResult }>(inScopeRes).result
  if (inScope.kind !== 'answer') {
    throw new Error(`expected an in-scope ANSWER, got ${inScope.kind}: ${JSON.stringify(inScope)}`)
  }
  if (inScope.citations.length < 1) throw new Error('in-scope answer has no citations')

  // 5b. Out-of-scope tutor question -> refusal (no fabricated citation).
  const outRes = await server.handle({
    method: 'POST',
    path: '/tutor/query',
    body: { pack_id: draft.pack_id, question: OUT_OF_SCOPE_QUESTION },
  })
  expect(outRes.status, 200, 'out-of-scope tutor query should return 200')
  const outOfScope = body<{ result: TutorResult }>(outRes).result
  if (outOfScope.kind !== 'refusal') {
    throw new Error(`expected an out-of-scope REFUSAL, got ${outOfScope.kind}`)
  }

  return {
    sourceId: src.source_id,
    anchorCount: src.anchors.length,
    packId: draft.pack_id,
    draftPack: draft.pack,
    draftValidationOk: draft.validation.ok,
    reviewedPack: reviewed.reviewed.pack,
    reviewedSavedAt: reviewed.reviewed.saved_at,
    modelAtomId: modelAtom.id,
    inScopeQuestion: IN_SCOPE_QUESTION,
    inScope,
    outOfScopeQuestion: OUT_OF_SCOPE_QUESTION,
    outOfScope,
  }
}

/** Tiny assertion used by the flow so it fails loudly outside Vitest too. */
function expect(actual: number, expected: number, what: string): void {
  if (actual !== expected) {
    throw new Error(`${what}: expected status ${expected}, got ${actual}`)
  }
}
