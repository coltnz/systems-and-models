import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createServer, type Server, type ApiResponse } from './index.js'

// --- Deterministic harness ---------------------------------------------------

/** Fixed tz-aware clock so DerivationRun.created_at is stable & validator-happy. */
const FIXED_NOW = (): Date => new Date('2026-06-01T12:00:00.000Z')

/** Sequential, predictable id factory for server-minted ids (packs/splits/edits). */
function seqIds(): () => string {
  let n = 0
  return () => `id-${++n}`
}

const SAMPLE_CONTENT = [
  'Systems thinking is the practice of seeing wholes rather than parts.',
  '',
  'A model is a simplified representation that helps you reason about a system.',
  '',
  'Feedback loops can amplify or dampen change within a system.',
].join('\n')

function newServer(dataDir: string): Server {
  return createServer({ dataDir, now: FIXED_NOW, idFactory: seqIds() })
}

async function postSource(server: Server): Promise<ApiResponse> {
  return server.handle({
    method: 'POST',
    path: '/sources',
    body: {
      title: 'Systems & Models Primer',
      media_type: 'markdown',
      license: 'CC-BY-4.0',
      access: 'open',
      content: SAMPLE_CONTENT,
    },
  })
}

async function draftPack(server: Server, sourceId: string): Promise<ApiResponse> {
  return server.handle({
    method: 'POST',
    path: '/packs/draft',
    body: { source_id: sourceId },
  })
}

// --- Temp dir lifecycle ------------------------------------------------------

let dataDir: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'sam-server-'))
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

// --- Happy path --------------------------------------------------------------

describe('happy path: source -> draft -> validate', () => {
  it('ingests a source, drafts a valid pack, and reads it back', async () => {
    const server = newServer(dataDir)

    const src = await postSource(server)
    expect(src.status).toBe(201)
    const srcBody = src.body as { source_id: string; anchors: unknown[] }
    expect(srcBody.source_id).toMatch(/^src-/)
    expect(srcBody.anchors.length).toBe(3)

    const draft = await draftPack(server, srcBody.source_id)
    expect(draft.status).toBe(201)
    const draftBody = draft.body as {
      pack_id: string
      pack: { atoms: unknown[]; derivations: unknown[]; relationships: unknown[] }
      validation: { ok: boolean }
    }
    // The draft pack validates: atoms reference real anchors + both derivations present.
    expect(draftBody.validation.ok).toBe(true)
    expect(draftBody.pack.atoms.length).toBeGreaterThanOrEqual(2)
    expect(draftBody.pack.derivations.length).toBe(2) // ingest + extract
    expect(draftBody.pack_id).toBe('id-1') // from injected idFactory

    const got = await server.handle({ method: 'GET', path: `/packs/${draftBody.pack_id}` })
    expect(got.status).toBe(200)

    const validated = await server.handle({
      method: 'POST',
      path: `/packs/${draftBody.pack_id}/validate`,
    })
    expect(validated.status).toBe(200)
    expect((validated.body as { validation: { ok: boolean } }).validation.ok).toBe(true)
  })

  it('lists sources and packs', async () => {
    const server = newServer(dataDir)
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    await draftPack(server, sourceId)

    const sources = await server.handle({ method: 'GET', path: '/sources' })
    expect((sources.body as { sources: unknown[] }).sources.length).toBe(1)

    const packs = await server.handle({ method: 'GET', path: '/packs' })
    expect((packs.body as { packs: unknown[] }).packs.length).toBe(1)
  })
})

// --- Review ops --------------------------------------------------------------

describe('review ops', () => {
  async function setup(server: Server): Promise<{ packId: string; atomIds: string[]; relId?: string }> {
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    const pack = (draft.body as { pack: { id: string; atoms: { id: string }[]; relationships: { id: string }[] } }).pack
    return {
      packId: pack.id,
      atomIds: pack.atoms.map((a) => a.id),
      relId: pack.relationships[0]?.id,
    }
  }

  function derivationCount(body: unknown): number {
    return (body as { pack: { derivations: unknown[] } }).pack.derivations.length
  }

  it('accept marks an atom reviewed and appends an edit derivation', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[0]}`,
      body: { op: 'accept' },
    })
    expect(res.status).toBe(200)
    const body = res.body as { pack: { atoms: { id: string; review_state: string }[]; derivations: { op: string; actor: string }[] }; validation: { ok: boolean } }
    expect(body.pack.atoms[0]!.review_state).toBe('reviewed')
    expect(body.validation.ok).toBe(true)
    // ingest + extract + one edit
    expect(body.pack.derivations.length).toBe(3)
    const last = body.pack.derivations.at(-1)!
    expect(last.op).toBe('edit')
    expect(last.actor).toBe('human')
  })

  it('reject marks an atom rejected', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[0]}`,
      body: { op: 'reject' },
    })
    expect(res.status).toBe(200)
    expect((res.body as { pack: { atoms: { review_state: string }[] } }).pack.atoms[0]!.review_state).toBe('rejected')
  })

  it('edit applies fields, bumps version, sets review_state=edited', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[0]}`,
      body: { op: 'edit', patch: { title: 'Edited title', summary: 'new summary' } },
    })
    expect(res.status).toBe(200)
    const atom = (res.body as { pack: { atoms: { title: string; summary: string; review_state: string; version: number }[] } }).pack.atoms[0]!
    expect(atom.title).toBe('Edited title')
    expect(atom.summary).toBe('new summary')
    expect(atom.review_state).toBe('edited')
    expect(atom.version).toBe(2)
  })

  it('set_support updates the matching anchor ref support_state', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    const pack = (await server.handle({ method: 'GET', path: `/packs/${packId}` })).body as {
      pack: { atoms: { id: string; anchors: { anchor_id: string }[] }[] }
    }
    const anchorId = pack.pack.atoms[0]!.anchors[0]!.anchor_id
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[0]}`,
      body: { op: 'set_support', anchor_id: anchorId, support_state: 'does_not_support' },
    })
    expect(res.status).toBe(200)
    const ref = (res.body as { pack: { atoms: { anchors: { anchor_id: string; support_state: string }[] }[] } }).pack.atoms[0]!.anchors.find((a) => a.anchor_id === anchorId)!
    expect(ref.support_state).toBe('does_not_support')
  })

  it('set_support 404s when the atom has no such anchor ref', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[0]}`,
      body: { op: 'set_support', anchor_id: 'anc-does-not-exist', support_state: 'supports' },
    })
    expect(res.status).toBe(404)
  })

  it('split grows the atom count and leaves the original intact', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    const before = (await server.handle({ method: 'GET', path: `/packs/${packId}` })).body as {
      pack: { atoms: { id: string; title: string }[] }
    }
    const beforeCount = before.pack.atoms.length
    const originalTitle = before.pack.atoms.find((a) => a.id === atomIds[0])!.title

    const res = await server.handle({
      method: 'POST',
      path: `/packs/${packId}/atoms/${atomIds[0]}/split`,
    })
    expect(res.status).toBe(201)
    const body = res.body as {
      new_atom_id: string
      pack: { atoms: { id: string; title: string; review_state: string; version: number }[] }
      validation: { ok: boolean }
    }
    expect(body.pack.atoms.length).toBe(beforeCount + 1)
    // original unchanged
    const original = body.pack.atoms.find((a) => a.id === atomIds[0])!
    expect(original.title).toBe(originalTitle)
    // new atom copies + suffixes
    const fresh = body.pack.atoms.find((a) => a.id === body.new_atom_id)!
    expect(fresh.title).toBe(`${originalTitle} (split)`)
    expect(fresh.review_state).toBe('generated')
    expect(fresh.version).toBe(1)
    expect(body.validation.ok).toBe(true)
    expect(derivationCount(res.body)).toBe(3)
  })

  it('relationship accept sets review_state and appends an edit derivation', async () => {
    const server = newServer(dataDir)
    const { packId, relId } = await setup(server)
    expect(relId).toBeDefined()
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/relationships/${relId}`,
      body: { op: 'accept' },
    })
    expect(res.status).toBe(200)
    const body = res.body as { pack: { relationships: { review_state: string }[]; derivations: unknown[] } }
    expect(body.pack.relationships[0]!.review_state).toBe('reviewed')
    expect(body.pack.derivations.length).toBe(3)
  })
})

// --- Reviewed snapshot -------------------------------------------------------

describe('reviewed snapshot', () => {
  it('saves a snapshot for a valid pack and writes the file', async () => {
    const server = newServer(dataDir)
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    const packId = (draft.body as { pack_id: string }).pack_id

    const res = await server.handle({ method: 'POST', path: `/packs/${packId}/reviewed` })
    expect(res.status).toBe(201)
    expect((res.body as { reviewed: { saved_at: string } }).reviewed.saved_at).toBe('2026-06-01T12:00:00.000Z')

    const file = join(dataDir, 'reviewed', `${packId}.json`)
    expect(existsSync(file)).toBe(true)
    const snapshot = JSON.parse(readFileSync(file, 'utf8')) as { pack: { id: string } }
    expect(snapshot.pack.id).toBe(packId)
  })

  it('returns 409 without saving when the pack is made structurally invalid', async () => {
    const server = newServer(dataDir)
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    const packId = (draft.body as { pack_id: string }).pack_id

    // Corrupt the stored pack on disk to force a validation failure (publish
    // invariant: a published atom with no supporting anchor is a graph error).
    const packFile = join(dataDir, 'packs', `${packId}.json`)
    const pack = JSON.parse(readFileSync(packFile, 'utf8')) as {
      atoms: { review_state: string; anchors: { support_state: string }[] }[]
    }
    pack.atoms[0]!.review_state = 'published'
    pack.atoms[0]!.anchors.forEach((a) => (a.support_state = 'does_not_support'))
    // Use the store path by re-importing via a fresh server over the same dir,
    // but we must actually persist the corruption — write it directly.
    const { writeFileSync } = await import('node:fs')
    writeFileSync(packFile, JSON.stringify(pack), 'utf8')

    const res = await server.handle({ method: 'POST', path: `/packs/${packId}/reviewed` })
    expect(res.status).toBe(409)
    expect((res.body as { validation: { ok: boolean } }).validation.ok).toBe(false)
    // No snapshot written.
    expect(existsSync(join(dataDir, 'reviewed', `${packId}.json`))).toBe(false)
  })
})

// --- Persistence across restart ----------------------------------------------

describe('persistence across restart', () => {
  it('a new server over the same dataDir sees the persisted source', async () => {
    const serverA = newServer(dataDir)
    const src = await postSource(serverA)
    const sourceId = (src.body as { source_id: string }).source_id

    // "Restart": a brand-new server object over the same dataDir.
    const serverB = newServer(dataDir)
    const got = await serverB.handle({ method: 'GET', path: `/sources/${sourceId}` })
    expect(got.status).toBe(200)
    expect((got.body as { source: { id: string } }).source.id).toBe(sourceId)
  })
})

// --- Errors / edge cases -----------------------------------------------------

describe('errors and edge cases', () => {
  it('404s for a missing source', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({ method: 'GET', path: '/sources/nope' })
    expect(res.status).toBe(404)
  })

  it('404s for a missing pack', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({ method: 'GET', path: '/packs/nope' })
    expect(res.status).toBe(404)
  })

  it('404s for a missing atom', async () => {
    const server = newServer(dataDir)
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    const packId = (draft.body as { pack_id: string }).pack_id
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/nope`,
      body: { op: 'accept' },
    })
    expect(res.status).toBe(404)
  })

  it('4xx for a malformed source body (missing required fields)', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({ method: 'POST', path: '/sources', body: { title: 'x' } })
    expect(res.status).toBe(400)
  })

  it('4xx for a malformed media_type', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({
      method: 'POST',
      path: '/sources',
      body: { title: 'x', media_type: 'pdf', license: 'CC', access: 'open', content: 'hi' },
    })
    expect(res.status).toBe(400)
  })

  it('4xx for a bad atom op', async () => {
    const server = newServer(dataDir)
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    const packId = (draft.body as { pack_id: string }).pack_id
    const atomId = (draft.body as { pack: { atoms: { id: string }[] } }).pack.atoms[0]!.id
    const res = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomId}`,
      body: { op: 'frobnicate' },
    })
    expect(res.status).toBe(400)
  })

  it('/tutor/query returns 501 (bd-9 placeholder)', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({ method: 'POST', path: '/tutor/query', body: { q: 'hi' } })
    expect(res.status).toBe(501)
    expect((res.body as { error: string }).error).toMatch(/bd-9/)
  })
})

// --- HTTP wiring + CORS ------------------------------------------------------

describe('http wiring', () => {
  it('listen(0) + fetch round-trips a request and sets CORS headers', async () => {
    const server = newServer(dataDir)
    const port = await server.listen(0)
    try {
      // OPTIONS preflight
      const pre = await fetch(`http://127.0.0.1:${port}/sources`, { method: 'OPTIONS' })
      expect(pre.status).toBe(204)
      expect(pre.headers.get('access-control-allow-origin')).toBe('*')

      // Real POST over the socket
      const res = await fetch(`http://127.0.0.1:${port}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Over HTTP',
          media_type: 'text',
          license: 'CC-BY-4.0',
          access: 'open',
          content: SAMPLE_CONTENT,
        }),
      })
      expect(res.status).toBe(201)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('content-type')).toContain('application/json')
      const body = (await res.json()) as { source_id: string }
      expect(body.source_id).toMatch(/^src-/)
    } finally {
      await server.close()
    }
  })
})
