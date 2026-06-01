/**
 * @sam/web — typed API client for the bd-7 local alpha server.
 *
 * Thin wrapper over the file-backed HTTP API (`@sam/server`). The browser talks
 * ONLY to this server (D-007 / bd-8 constraint): no direct fs/db, no sql.js.
 *
 * Base URL comes from `import.meta.env.VITE_API_BASE`, defaulting to the server's
 * localhost bind `http://127.0.0.1:8787`. The server sends permissive CORS (`*`),
 * so a direct `fetch` from the Vite dev origin works. Fixing the server port +
 * a combined dev script is bd-10's job; this client only needs the base URL.
 *
 * Mutations return `{ pack, validation }`; `split` adds `new_atom_id`. Validation
 * errors are `{ code, path, message, severity: "structural" | "graph" }`. The UI
 * treats `structural` as blocking and `graph` as warnings.
 */
import type {
  Atom,
  AtomKind,
  LearningPack,
  MediaType,
  Access,
  ReviewState,
  SupportState,
} from '@sam/types'

// --- Validation shapes (mirror @sam/validator's public result) --------------

export type Severity = 'structural' | 'graph'

export interface ValidationError {
  code: string
  path: string
  message: string
  severity: Severity
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

// --- Response shapes --------------------------------------------------------

export interface PackListItem {
  id: string
  title: string
  version: string
}

export interface SourceMutationResult {
  source_id: string
  source: unknown
  anchors: unknown[]
}

export interface DraftResult {
  pack_id: string
  pack: LearningPack
  validation: ValidationResult
}

export interface MutationResult {
  pack: LearningPack
  validation: ValidationResult
}

export interface SplitResult extends MutationResult {
  new_atom_id: string
}

export interface ReviewedOk {
  ok: true
  reviewed: { pack: LearningPack; saved_at: string }
}

export interface ReviewedConflict {
  ok: false
  validation: ValidationResult
}

export type ReviewedResult = ReviewedOk | ReviewedConflict

export interface TutorCitation {
  atom_id: string
  anchor_id: string
  excerpt: string
}

export type TutorResult =
  | { kind: 'answer'; text: string; citations: TutorCitation[] }
  | { kind: 'refusal'; reason: string }

// --- Request bodies ---------------------------------------------------------

export interface NewSourceInput {
  title: string
  media_type: Extract<MediaType, 'markdown' | 'text'>
  license: string
  access: Access
  content: string
  creator?: string
}

export type AtomEditPatch = {
  title?: string
  summary?: string
  body?: string
  steps?: { text: string }[]
}

// --- Error type -------------------------------------------------------------

/** Thrown for non-2xx responses the UI does not model as a domain outcome. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// --- Base URL ---------------------------------------------------------------

const DEFAULT_BASE = 'http://127.0.0.1:8787'

/** Resolve the API base from Vite env, falling back to the server bind. */
export function apiBase(): string {
  const fromEnv =
    typeof import.meta !== 'undefined' &&
    (import.meta as ImportMeta).env?.VITE_API_BASE
  return (fromEnv && String(fromEnv)) || DEFAULT_BASE
}

// --- Fetch helpers ----------------------------------------------------------

interface RequestOptions {
  method?: string
  body?: unknown
  /** Status codes the caller handles as a domain outcome (not an ApiError). */
  expect?: number[]
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ status: number; data: T }> {
  const { method = 'GET', body, expect } = opts
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let data: unknown
  const text = await res.text()
  if (text.length > 0) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  const tolerated = res.ok || (expect?.includes(res.status) ?? false)
  if (!tolerated) {
    const message =
      (typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `request failed (${res.status})`) || `request failed (${res.status})`
    throw new ApiError(res.status, message, data)
  }

  return { status: res.status, data: data as T }
}

// --- Routes -----------------------------------------------------------------

/** `POST /sources` — ingest a source asset, returns its id + anchors. */
export async function createSource(input: NewSourceInput): Promise<SourceMutationResult> {
  const { data } = await request<SourceMutationResult>('/sources', {
    method: 'POST',
    body: input,
  })
  return data
}

/** `POST /packs/draft` — extract a draft pack from a source id. */
export async function createDraft(source_id: string, title?: string): Promise<DraftResult> {
  const { data } = await request<DraftResult>('/packs/draft', {
    method: 'POST',
    body: title === undefined ? { source_id } : { source_id, title },
  })
  return data
}

/** Convenience: ingest a source then draft a pack from it in one call. */
export async function createSourceAndDraft(
  input: NewSourceInput,
  title?: string,
): Promise<DraftResult> {
  const src = await createSource(input)
  return createDraft(src.source_id, title)
}

/** `GET /packs` — list saved packs. */
export async function listPacks(): Promise<PackListItem[]> {
  const { data } = await request<{ packs: PackListItem[] }>('/packs')
  return data.packs
}

/** `GET /packs/:id` — load a single pack. */
export async function getPack(id: string): Promise<LearningPack> {
  const { data } = await request<{ pack: LearningPack }>(`/packs/${encodeURIComponent(id)}`)
  return data.pack
}

/** `POST /packs/:id/validate` — re-run validation. */
export async function validate(id: string): Promise<ValidationResult> {
  const { data } = await request<{ validation: ValidationResult }>(
    `/packs/${encodeURIComponent(id)}/validate`,
    { method: 'POST' },
  )
  return data.validation
}

/** `PATCH /packs/:id/atoms/:atomId` `{op:"accept"}`. */
export function acceptAtom(packId: string, atomId: string): Promise<MutationResult> {
  return patchAtom(packId, atomId, { op: 'accept' })
}

/** `PATCH /packs/:id/atoms/:atomId` `{op:"reject"}`. */
export function rejectAtom(packId: string, atomId: string): Promise<MutationResult> {
  return patchAtom(packId, atomId, { op: 'reject' })
}

/** `PATCH /packs/:id/atoms/:atomId` `{op:"edit", patch}`. */
export function editAtom(
  packId: string,
  atomId: string,
  patch: AtomEditPatch,
): Promise<MutationResult> {
  return patchAtom(packId, atomId, { op: 'edit', patch })
}

/** `PATCH /packs/:id/atoms/:atomId` `{op:"set_support", anchor_id, support_state}`. */
export function setSupport(
  packId: string,
  atomId: string,
  anchor_id: string,
  support_state: SupportState,
): Promise<MutationResult> {
  return patchAtom(packId, atomId, { op: 'set_support', anchor_id, support_state })
}

async function patchAtom(
  packId: string,
  atomId: string,
  body: unknown,
): Promise<MutationResult> {
  const { data } = await request<MutationResult>(
    `/packs/${encodeURIComponent(packId)}/atoms/${encodeURIComponent(atomId)}`,
    { method: 'PATCH', body },
  )
  return data
}

/** `POST /packs/:id/atoms/:atomId/split` — split-lite (clone into a new draft atom). */
export async function splitAtom(packId: string, atomId: string): Promise<SplitResult> {
  const { data } = await request<SplitResult>(
    `/packs/${encodeURIComponent(packId)}/atoms/${encodeURIComponent(atomId)}/split`,
    { method: 'POST' },
  )
  return data
}

/** `PATCH /packs/:id/relationships/:relId` `{op:"accept"|"reject"}`. */
export async function patchRelationship(
  packId: string,
  relId: string,
  op: 'accept' | 'reject',
): Promise<MutationResult> {
  const { data } = await request<MutationResult>(
    `/packs/${encodeURIComponent(packId)}/relationships/${encodeURIComponent(relId)}`,
    { method: 'PATCH', body: { op } },
  )
  return data
}

/** `POST /packs/:id/reviewed` — save a reviewed snapshot. 201 ok | 409 invalid. */
export async function saveReviewed(packId: string): Promise<ReviewedResult> {
  const { status, data } = await request<
    { reviewed: { pack: LearningPack; saved_at: string } } | { validation: ValidationResult }
  >(`/packs/${encodeURIComponent(packId)}/reviewed`, {
    method: 'POST',
    expect: [409],
  })
  if (status === 201 && 'reviewed' in data) {
    return { ok: true, reviewed: data.reviewed }
  }
  return { ok: false, validation: (data as { validation: ValidationResult }).validation }
}

/** `POST /tutor/query` — cite-or-refuse against the reviewed snapshot. */
export async function tutorQuery(pack_id: string, question: string): Promise<TutorResult> {
  const { data } = await request<{ result: TutorResult }>('/tutor/query', {
    method: 'POST',
    body: { pack_id, question },
  })
  return data.result
}

// Re-export domain types for consumers that import via the client.
export type { Atom, AtomKind, LearningPack, ReviewState, SupportState }
