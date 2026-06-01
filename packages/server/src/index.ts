/**
 * @sam/server — the local, file-backed HTTP API for the alpha (bd-7).
 *
 * Ties the pure packages together: ingest (bd-5) -> extraction (bd-6) ->
 * validation (bd-4) -> human review edits -> reviewed-pack save. It is the SOLE
 * owner of the gitignored `.systems-and-models/` runtime dir (D-007). No DB, no
 * auth, localhost only.
 *
 * Design:
 *  - {@link handle} is a PURE async request core: `(req) => Promise<Response>`.
 *    It does all the work against a {@link Store} bound to `dataDir`. Tests drive
 *    it directly (no sockets) for determinism.
 *  - {@link createServer} wraps `handle` in a `node:http` server; `listen(port)`
 *    really binds (for the web UI bd-8) and `close()` shuts it down.
 *  - Every response is JSON and carries permissive localhost CORS headers so the
 *    Vite-hosted web UI (`:5173`) can call this API on another port. `OPTIONS`
 *    preflight is answered with 204.
 *  - Determinism: timestamps come from `options.now` and ids from
 *    `options.idFactory`, both injectable. Tests pass fixed clocks/id sequences.
 *
 * Correctness rule for mutations: every mutation re-validates the pack and only
 * persists if it introduces no STRUCTURAL error. Graph-level errors (e.g. an
 * unmet publish invariant mid-review) are allowed to exist on a draft, so they
 * never block persistence — but a structurally-broken pack is never written. A
 * reviewed snapshot, by contrast, must be fully valid (`validation.ok`).
 */
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'

import { getAdapter, type ExtractionAdapter } from '@sam/extraction'
import { ingestSource, UnsupportedMediaTypeError } from '@sam/ingest'
import { validatePack, type ValidationResult } from '@sam/validator'
import type {
  Atom,
  AtomKind,
  DerivationRun,
  LearningPack,
  Relationship,
  SupportState,
} from '@sam/types'

import { Store, type StoredReviewed, type StoredSource } from './store.js'

// --- Public options / server -------------------------------------------------

export interface ServerOptions {
  /** Runtime data dir owned by this package (D-007). Default `.systems-and-models`. */
  dataDir?: string
  /** Extraction backend; defaults to the env-selected adapter (mock offline). */
  adapter?: ExtractionAdapter
  /** Clock for all timestamps in the data path. Injected for determinism. */
  now?: () => Date
  /** Id source for ids the server mints (split atoms, edit derivations). */
  idFactory?: () => string
}

export interface Server {
  readonly dataDir: string
  readonly adapter: ExtractionAdapter
  /** Pure request core — drive this directly in tests (no sockets). */
  handle(req: ApiRequest): Promise<ApiResponse>
  /** Bind a real `node:http` server on `port` (0 = ephemeral). Returns the port. */
  listen(port: number): Promise<number>
  /** Graceful shutdown of the bound http server (no-op if never listened). */
  close(): Promise<void>
}

// --- Request / response model ------------------------------------------------

/** A normalized request the pure core understands. `body` is already parsed. */
export interface ApiRequest {
  method: string
  /** Path only (no query string), e.g. `/packs/abc/atoms/xyz`. */
  path: string
  /** Parsed JSON body, or undefined for bodyless requests. */
  body?: unknown
}

/** A JSON response. `body` is serialized by the caller / http wrapper. */
export interface ApiResponse {
  status: number
  body: unknown
}

// --- Constants ---------------------------------------------------------------

const PACK_VERSION = '0.1.0'
const SCHEMA_VERSION = '0' as const

/** Permissive localhost CORS for the alpha (web UI on a different Vite port). */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

const DEFAULT_NOW = (): Date => new Date()

// --- Small helpers -----------------------------------------------------------

function ok(status: number, body: unknown): ApiResponse {
  return { status, body }
}

function err(status: number, message: string): ApiResponse {
  return { status, body: { error: message } }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

/** Split a path into non-empty segments. `/packs/a/atoms/b` -> ["packs","a",...]. */
function segments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0)
}

// --- The pure request core ---------------------------------------------------

interface CoreDeps {
  store: Store
  adapter: ExtractionAdapter
  now: () => Date
  idFactory: () => string
}

/**
 * Route + execute a single request against the store. Pure with respect to
 * sockets: it never touches the network and reads/writes only through `store`.
 */
async function route(req: ApiRequest, deps: CoreDeps): Promise<ApiResponse> {
  const seg = segments(req.path)
  const m = req.method.toUpperCase()

  // CORS preflight — answered for any path.
  if (m === 'OPTIONS') return { status: 204, body: undefined }

  // /sources ...
  if (seg[0] === 'sources') {
    if (seg.length === 1) {
      if (m === 'POST') return postSource(req, deps)
      if (m === 'GET') return ok(200, { sources: deps.store.listSources() })
      return err(405, `method ${m} not allowed on /sources`)
    }
    if (seg.length === 2) {
      if (m === 'GET') return getSource(seg[1]!, deps)
      return err(405, `method ${m} not allowed on /sources/:id`)
    }
    return err(404, 'not found')
  }

  // /packs ...
  if (seg[0] === 'packs') {
    if (seg.length === 1) {
      if (m === 'GET') return ok(200, { packs: deps.store.listPacks() })
      return err(405, `method ${m} not allowed on /packs`)
    }
    if (seg.length === 2 && seg[1] === 'draft') {
      if (m === 'POST') return postPackDraft(req, deps)
      return err(405, `method ${m} not allowed on /packs/draft`)
    }
    if (seg.length === 2) {
      if (m === 'GET') return getPack(seg[1]!, deps)
      return err(405, `method ${m} not allowed on /packs/:id`)
    }
    // /packs/:id/<action...>
    const packId = seg[1]!
    const action = seg[2]!
    if (seg.length === 3 && action === 'validate') {
      if (m === 'POST') return postValidate(packId, deps)
      return err(405, `method ${m} not allowed on /packs/:id/validate`)
    }
    if (seg.length === 3 && action === 'reviewed') {
      if (m === 'POST') return postReviewed(packId, deps)
      return err(405, `method ${m} not allowed on /packs/:id/reviewed`)
    }
    if (action === 'atoms') {
      const atomId = seg[3]
      if (seg.length === 4 && atomId !== undefined) {
        if (m === 'PATCH') return patchAtom(packId, atomId, req, deps)
        return err(405, `method ${m} not allowed on /packs/:id/atoms/:atomId`)
      }
      if (seg.length === 5 && atomId !== undefined && seg[4] === 'split') {
        if (m === 'POST') return splitAtom(packId, atomId, deps)
        return err(405, `method ${m} not allowed on /packs/:id/atoms/:atomId/split`)
      }
      return err(404, 'not found')
    }
    if (action === 'relationships') {
      const relId = seg[3]
      if (seg.length === 4 && relId !== undefined) {
        if (m === 'PATCH') return patchRelationship(packId, relId, req, deps)
        return err(405, `method ${m} not allowed on /packs/:id/relationships/:relId`)
      }
      return err(404, 'not found')
    }
    return err(404, 'not found')
  }

  // /tutor/query — placeholder for bd-9.
  if (seg[0] === 'tutor' && seg[1] === 'query' && seg.length === 2) {
    if (m === 'POST') return err(501, 'tutor implemented in bd-9')
    return err(405, `method ${m} not allowed on /tutor/query`)
  }

  return err(404, 'not found')
}

// --- Sources -----------------------------------------------------------------

async function postSource(req: ApiRequest, deps: CoreDeps): Promise<ApiResponse> {
  const b = req.body
  if (!isObject(b)) return err(400, 'body must be a JSON object')

  const title = asString(b.title)
  const media_type = asString(b.media_type)
  const license = asString(b.license)
  const access = asString(b.access)
  const content = asString(b.content)
  const creator = asString(b.creator)
  const uri = asString(b.uri)

  if (!title) return err(400, 'title is required')
  if (media_type !== 'markdown' && media_type !== 'text') {
    return err(400, 'media_type must be "markdown" or "text"')
  }
  if (!license) return err(400, 'license is required')
  if (access !== 'owned' && access !== 'open' && access !== 'restricted') {
    return err(400, 'access must be "owned", "open", or "restricted"')
  }
  if (content === undefined) return err(400, 'content is required')

  let result
  try {
    result = await ingestSource(
      {
        uri: uri ?? `inline:${title}`,
        media_type,
        title,
        ...(creator !== undefined ? { creator } : {}),
        license,
        access,
        content,
      },
      { now: deps.now },
    )
  } catch (e) {
    if (e instanceof UnsupportedMediaTypeError) return err(400, e.message)
    return err(400, e instanceof Error ? e.message : 'ingest failed')
  }

  const stored: StoredSource = {
    source: result.source,
    anchors: result.anchors,
    ingestDerivation: result.derivation,
  }
  deps.store.putSource(stored)

  return ok(201, {
    source_id: result.source.id,
    source: result.source,
    anchors: result.anchors,
  })
}

function getSource(id: string, deps: CoreDeps): ApiResponse {
  const s = deps.store.getSource(id)
  if (!s) return err(404, `source "${id}" not found`)
  return ok(200, { source: s.source, anchors: s.anchors })
}

// --- Pack draft --------------------------------------------------------------

async function postPackDraft(req: ApiRequest, deps: CoreDeps): Promise<ApiResponse> {
  const b = req.body
  if (!isObject(b)) return err(400, 'body must be a JSON object')
  const source_id = asString(b.source_id)
  const titleOverride = asString(b.title)
  if (!source_id) return err(400, 'source_id is required')

  const stored = deps.store.getSource(source_id)
  if (!stored) return err(404, `source "${source_id}" not found`)

  const extraction = await deps.adapter.extract({
    source_asset_id: stored.source.id,
    text: stored.anchors.map((a) => a.excerpt).join('\n\n'),
    anchors: stored.anchors,
  })

  const pack: LearningPack = {
    id: deps.idFactory(),
    title: titleOverride ?? `Pack: ${stored.source.title}`,
    version: PACK_VERSION,
    schema_version: SCHEMA_VERSION,
    license: stored.source.license,
    sources: [stored.source],
    anchors: stored.anchors,
    atoms: extraction.atoms,
    relationships: extraction.relationships,
    // Persist BOTH derivations or atoms' derivation_id dangles (bd-6 follow-up).
    derivations: [stored.ingestDerivation, extraction.derivation],
  }

  const validation = validatePack(pack)
  // A draft may carry graph-level issues, but never persist a structurally-broken pack.
  if (hasStructuralError(validation)) {
    return err(500, 'assembled draft pack is structurally invalid')
  }
  deps.store.putPack(pack)

  return ok(201, { pack_id: pack.id, pack, validation })
}

function getPack(id: string, deps: CoreDeps): ApiResponse {
  const p = deps.store.getPack(id)
  if (!p) return err(404, `pack "${id}" not found`)
  return ok(200, { pack: p })
}

function postValidate(packId: string, deps: CoreDeps): ApiResponse {
  const pack = deps.store.getPack(packId)
  if (!pack) return err(404, `pack "${packId}" not found`)
  return ok(200, { validation: validatePack(pack) })
}

// --- Review edits ------------------------------------------------------------

function hasStructuralError(v: ValidationResult): boolean {
  return v.errors.some((e) => e.severity === 'structural')
}

/** Append an `edit`/human DerivationRun for a review mutation. */
function appendEditDerivation(
  pack: LearningPack,
  deps: CoreDeps,
  inputIds: string[],
): void {
  const derivation: DerivationRun = {
    id: deps.idFactory(),
    op: 'edit',
    input_ids: inputIds,
    actor: 'human',
    schema_version: SCHEMA_VERSION,
    created_at: deps.now().toISOString(),
  }
  pack.derivations.push(derivation)
}

/**
 * Persist a mutated pack iff it is structurally valid, returning the standard
 * `{ pack, validation }` body. Graph-level errors are tolerated mid-review.
 */
function persistMutation(
  pack: LearningPack,
  deps: CoreDeps,
  status = 200,
  extra: Record<string, unknown> = {},
): ApiResponse {
  const validation = validatePack(pack)
  if (hasStructuralError(validation)) {
    return ok(422, { error: 'edit would make the pack structurally invalid', validation })
  }
  deps.store.putPack(pack)
  return ok(status, { pack, validation, ...extra })
}

function patchAtom(
  packId: string,
  atomId: string,
  req: ApiRequest,
  deps: CoreDeps,
): ApiResponse {
  const pack = deps.store.getPack(packId)
  if (!pack) return err(404, `pack "${packId}" not found`)
  const atom = pack.atoms.find((a) => a.id === atomId)
  if (!atom) return err(404, `atom "${atomId}" not found in pack "${packId}"`)

  const b = req.body
  if (!isObject(b)) return err(400, 'body must be a JSON object')
  const op = asString(b.op)

  if (op === 'accept') {
    atom.review_state = 'reviewed'
  } else if (op === 'reject') {
    atom.review_state = 'rejected'
  } else if (op === 'edit') {
    const patch = b.patch
    if (!isObject(patch)) return err(400, 'edit requires a "patch" object')
    const applied = applyAtomPatch(atom, patch)
    if (applied !== undefined) return err(400, applied)
    atom.review_state = 'edited'
    atom.version += 1
  } else if (op === 'set_support') {
    const anchor_id = asString(b.anchor_id)
    const support_state = asString(b.support_state)
    if (!anchor_id) return err(400, 'set_support requires "anchor_id"')
    if (!isSupportState(support_state)) {
      return err(400, 'set_support requires a valid "support_state"')
    }
    const ref = atom.anchors.find((r) => r.anchor_id === anchor_id)
    if (!ref) {
      return err(404, `atom "${atomId}" has no anchor ref "${anchor_id}"`)
    }
    ref.support_state = support_state
  } else {
    return err(400, 'op must be one of accept|reject|edit|set_support')
  }

  appendEditDerivation(pack, deps, [atomId])
  return persistMutation(pack, deps)
}

/** Apply edit fields in place; returns an error message string or undefined. */
function applyAtomPatch(atom: Atom, patch: Record<string, unknown>): string | undefined {
  if ('title' in patch) {
    const v = asString(patch.title)
    if (v === undefined) return 'patch.title must be a string'
    atom.title = v
  }
  if ('summary' in patch) {
    const v = asString(patch.summary)
    if (v === undefined) return 'patch.summary must be a string'
    atom.summary = v
  }
  if ('body' in patch) {
    const v = asString(patch.body)
    if (v === undefined) return 'patch.body must be a string'
    atom.body = v
  }
  if ('steps' in patch) {
    const steps = patch.steps
    if (!Array.isArray(steps)) return 'patch.steps must be an array'
    const out: { text: string }[] = []
    for (const s of steps) {
      const text = isObject(s) ? asString(s.text) : undefined
      if (text === undefined) return 'each step must be { text: string }'
      out.push({ text })
    }
    atom.steps = out
  }
  return undefined
}

function isSupportState(v: unknown): v is SupportState {
  return (
    v === 'supports' ||
    v === 'partially' ||
    v === 'does_not_support' ||
    v === 'disputed'
  )
}

function splitAtom(packId: string, atomId: string, deps: CoreDeps): ApiResponse {
  const pack = deps.store.getPack(packId)
  if (!pack) return err(404, `pack "${packId}" not found`)
  const src = pack.atoms.find((a) => a.id === atomId)
  if (!src) return err(404, `atom "${atomId}" not found in pack "${packId}"`)

  const newId = deps.idFactory()
  const newAtom: Atom = {
    id: newId,
    kind: src.kind as AtomKind,
    title: `${src.title} (split)`,
    ...(src.summary !== undefined ? { summary: src.summary } : {}),
    ...(src.body !== undefined ? { body: src.body } : {}),
    ...(src.steps !== undefined ? { steps: src.steps.map((s) => ({ text: s.text })) } : {}),
    review_state: 'generated',
    authored_by: src.authored_by,
    anchors: src.anchors.map((r) => ({ ...r })),
    derivation_id: src.derivation_id,
    version: 1,
  }
  pack.atoms.push(newAtom)

  appendEditDerivation(pack, deps, [atomId])
  return persistMutation(pack, deps, 201, { new_atom_id: newId })
}

function patchRelationship(
  packId: string,
  relId: string,
  req: ApiRequest,
  deps: CoreDeps,
): ApiResponse {
  const pack = deps.store.getPack(packId)
  if (!pack) return err(404, `pack "${packId}" not found`)
  const rel: Relationship | undefined = pack.relationships.find((r) => r.id === relId)
  if (!rel) return err(404, `relationship "${relId}" not found in pack "${packId}"`)

  const b = req.body
  if (!isObject(b)) return err(400, 'body must be a JSON object')
  const op = asString(b.op)
  if (op === 'accept') {
    rel.review_state = 'reviewed'
  } else if (op === 'reject') {
    rel.review_state = 'rejected'
  } else {
    return err(400, 'op must be "accept" or "reject"')
  }

  appendEditDerivation(pack, deps, [relId])
  return persistMutation(pack, deps)
}

// --- Reviewed snapshot -------------------------------------------------------

function postReviewed(packId: string, deps: CoreDeps): ApiResponse {
  const pack = deps.store.getPack(packId)
  if (!pack) return err(404, `pack "${packId}" not found`)

  const validation = validatePack(pack)
  // A reviewed pack MUST be fully valid — do not save an invalid snapshot.
  if (!validation.ok) return ok(409, { validation })

  const reviewed: StoredReviewed = {
    pack,
    saved_at: deps.now().toISOString(),
  }
  deps.store.putReviewed(packId, reviewed)
  return ok(201, { reviewed })
}

// --- Public factory ----------------------------------------------------------

/** Sequential id factory used by default for server-minted ids. */
function defaultIdFactory(): () => string {
  let n = 0
  return () => `srv-${(++n).toString(36)}-${Date.now().toString(36)}`
}

/**
 * Build a server with a pure `handle` core and a `node:http` wrapper. Touches no
 * disk until a route writes (D-007). `listen`/`close` manage the http binding.
 */
export function createServer(options: ServerOptions = {}): Server {
  const dataDir = options.dataDir ?? '.systems-and-models'
  const adapter = options.adapter ?? getAdapter(process.env)
  const now = options.now ?? DEFAULT_NOW
  const idFactory = options.idFactory ?? defaultIdFactory()

  const deps: CoreDeps = { store: new Store(dataDir), adapter, now, idFactory }

  let httpServer: HttpServer | undefined

  const handle = async (req: ApiRequest): Promise<ApiResponse> => {
    try {
      return await route(req, deps)
    } catch (e) {
      // Never leak a stack to the client; keep the alpha resilient.
      return err(500, e instanceof Error ? e.message : 'internal error')
    }
  }

  return {
    dataDir,
    adapter,
    handle,

    listen(port: number): Promise<number> {
      const server = createHttpServer((httpReq, httpRes) => {
        const chunks: Buffer[] = []
        httpReq.on('data', (c: Buffer) => chunks.push(c))
        httpReq.on('end', () => {
          void (async () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            const url = httpReq.url ?? '/'
            const path = url.split('?')[0] ?? '/'
            let body: unknown
            if (raw.length > 0) {
              try {
                body = JSON.parse(raw)
              } catch {
                writeResponse(httpRes, err(400, 'invalid JSON body'))
                return
              }
            }
            const response = await handle({ method: httpReq.method ?? 'GET', path, body })
            writeResponse(httpRes, response)
          })()
        })
      })
      httpServer = server
      return new Promise<number>((resolve, reject) => {
        server.once('error', reject)
        // Bind to loopback only — localhost-only per the alpha brief.
        server.listen(port, '127.0.0.1', () => {
          const addr = server.address()
          const bound = typeof addr === 'object' && addr ? addr.port : port
          resolve(bound)
        })
      })
    },

    close(): Promise<void> {
      const server = httpServer
      if (!server) return Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()))
      })
    },
  }
}

/** Serialize an {@link ApiResponse} to a `node:http` response with CORS headers. */
function writeResponse(
  httpRes: import('node:http').ServerResponse,
  response: ApiResponse,
): void {
  const headers = { ...CORS_HEADERS }
  if (response.body === undefined) {
    httpRes.writeHead(response.status, headers)
    httpRes.end()
    return
  }
  httpRes.writeHead(response.status, headers)
  httpRes.end(JSON.stringify(response.body))
}

// Re-exports for consumers/tests.
export { Store } from './store.js'
export type {
  StoredSource,
  StoredReviewed,
  SourceListItem,
  PackListItem,
} from './store.js'
export type { ExtractionAdapter } from '@sam/extraction'
export type {
  LearningPack,
  SourceAsset,
  SourceAnchor,
  Atom,
  Relationship,
  DerivationRun,
} from '@sam/types'
