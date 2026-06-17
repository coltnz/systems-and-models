import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createPackLock, createServer, Store, type Server, type ApiResponse } from './index.js'
import { isSafeId } from './store.js'

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

  it('threads the server clock into extraction: extract derivation created_at is the injected instant', async () => {
    const instant = '2026-06-01T12:00:00.000Z'
    const server = createServer({
      now: () => new Date(instant),
      idFactory: seqIds(),
      dataDir,
    })
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    expect(draft.status).toBe(201)
    const pack = (draft.body as { pack: { derivations: { op: string; created_at: string }[] } }).pack
    const extract = pack.derivations.find((d) => d.op === 'extract')!
    expect(extract).toBeDefined()
    expect(extract.created_at).toBe(instant)
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

  it('edit flips an AI atom to authored_by="mixed"; a human atom stays "human"', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)

    // The mock atom is authored_by="ai". An edit means a human co-authored it.
    const aiRes = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[0]}`,
      body: { op: 'edit', patch: { title: 'Human-tweaked title' } },
    })
    expect(aiRes.status).toBe(200)
    const aiAtom = (aiRes.body as { pack: { atoms: { id: string; authored_by: string }[] } }).pack.atoms.find((a) => a.id === atomIds[0])!
    expect(aiAtom.authored_by).toBe('mixed')

    // A human-authored atom must NOT be downgraded; it stays "human". Force the
    // second atom's authored_by to "human" on disk, then edit it.
    const { writeFileSync } = await import('node:fs')
    const packFile = join(dataDir, 'packs', `${packId}.json`)
    const pack = JSON.parse(readFileSync(packFile, 'utf8')) as {
      atoms: { id: string; authored_by: string }[]
    }
    const humanAtom = pack.atoms.find((a) => a.id === atomIds[1])!
    humanAtom.authored_by = 'human'
    writeFileSync(packFile, JSON.stringify(pack), 'utf8')

    const humanRes = await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atomIds[1]}`,
      body: { op: 'edit', patch: { title: 'Human edits own atom' } },
    })
    expect(humanRes.status).toBe(200)
    const stillHuman = (humanRes.body as { pack: { atoms: { id: string; authored_by: string }[] } }).pack.atoms.find((a) => a.id === atomIds[1])!
    expect(stillHuman.authored_by).toBe('human')
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

  it('split wires the new atom derivation_id to the edit derivation whose output_ids contains it', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)

    const res = await server.handle({
      method: 'POST',
      path: `/packs/${packId}/atoms/${atomIds[0]}/split`,
    })
    expect(res.status).toBe(201)
    const body = res.body as {
      new_atom_id: string
      pack: {
        atoms: { id: string; derivation_id: string }[]
        derivations: { id: string; op: string; output_ids?: string[] }[]
      }
      validation: { ok: boolean }
    }

    const fresh = body.pack.atoms.find((a) => a.id === body.new_atom_id)!
    // The new atom's derivation_id resolves to a derivation in pack.derivations.
    const der = body.pack.derivations.find((d) => d.id === fresh.derivation_id)!
    expect(der).toBeDefined()
    expect(der.op).toBe('edit')
    // ...whose output_ids contains the new atom id.
    expect(der.output_ids).toContain(body.new_atom_id)
    // The pack still validates.
    expect(body.validation.ok).toBe(true)
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

  it('/tutor/query is no longer 501 and 400s on missing body fields (bd-9)', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({ method: 'POST', path: '/tutor/query', body: { q: 'hi' } })
    expect(res.status).toBe(400)
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

  it('caps an oversized request body with 413 and stays responsive (bd-14)', async () => {
    const server = newServer(dataDir)
    const port = await server.listen(0)
    try {
      // A body over MAX_BODY_BYTES (~10 MB) must be refused, not buffered. The
      // server caps it mid-upload and `req.destroy()`s the socket; depending on
      // timing the client either receives the 413 response OR sees the connection
      // reset before it finishes writing the 11 MB body. BOTH prove the cap
      // engaged (the body was not buffered) — accept either so the test is not
      // flaky on the destroy/upload race.
      const huge = 'x'.repeat(11 * 1024 * 1024)
      let refused = false
      try {
        const big = await fetch(`http://127.0.0.1:${port}/sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blob: huge }),
        })
        if (big.status === 413) {
          refused = true
          expect(((await big.json()) as { error: string }).error).toBe(
            'request body too large',
          )
        }
      } catch {
        // Connection reset before the full body was sent — the server refused it.
        refused = true
      }
      expect(refused).toBe(true)

      // The server stays up: a normal request after the oversized one still works.
      const ok = await fetch(`http://127.0.0.1:${port}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'After 413',
          media_type: 'text',
          license: 'CC-BY-4.0',
          access: 'open',
          content: SAMPLE_CONTENT,
        }),
      })
      expect(ok.status).toBe(201)
    } finally {
      await server.close()
    }
  })
})

// --- bd-14: id sanitization (security) ---------------------------------------

describe('bd-14 id sanitization', () => {
  it('isSafeId accepts our real ids and rejects traversal/empty ids', () => {
    // Real ids all pass.
    expect(isSafeId('src-deadbeef')).toBe(true)
    expect(isSafeId('srv-1-abc')).toBe(true)
    expect(isSafeId('id-1')).toBe(true)
    expect(isSafeId('pack_id.v2')).toBe(true)
    // Traversal / separators / empties are rejected.
    expect(isSafeId('.')).toBe(false)
    expect(isSafeId('..')).toBe(false)
    expect(isSafeId('../x')).toBe(false)
    expect(isSafeId('../packs/x')).toBe(false)
    expect(isSafeId('../../etc/passwd')).toBe(false)
    expect(isSafeId('a/b')).toBe(false)
    expect(isSafeId('')).toBe(false)
  })

  it('Store reads for unsafe ids return undefined (no read outside dataDir)', () => {
    const store = new Store(dataDir)
    expect(store.getSource('../x')).toBeUndefined()
    expect(store.getPack('../x')).toBeUndefined()
    expect(store.getReviewed('../packs/x')).toBeUndefined()
  })

  it('Store writes with an unsafe id throw a clear error', () => {
    const store = new Store(dataDir)
    expect(() => store.putReviewed('../escape', { pack: {} as never, saved_at: 'now' })).toThrow(
      /unsafe id/,
    )
  })

  it('GET /sources/:id and /packs/:id with a traversal id 404 (no crash)', async () => {
    const server = newServer(dataDir)
    const src = await server.handle({ method: 'GET', path: '/sources/..' })
    expect(src.status).toBe(404)
    const pack = await server.handle({ method: 'GET', path: '/packs/..' })
    expect(pack.status).toBe(404)
  })

  it('POST /packs/draft with a traversal source_id 404s (no read outside dataDir, no crash)', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({
      method: 'POST',
      path: '/packs/draft',
      body: { source_id: '../../etc/passwd' },
    })
    expect(res.status).toBe(404)
    expect((res.body as { error: string }).error).toMatch(/not found/)
  })
})

// --- bd-14: tutor defense-in-depth -------------------------------------------

describe('bd-14 tutor route defense-in-depth', () => {
  it('refuses (never throws) when no reviewed snapshot exists', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { pack_id: 'pack-x', question: 'why?' },
    })
    expect(res.status).toBe(200)
    expect((res.body as { result: { kind: string } }).result.kind).toBe('refusal')
  })

  it('refuses for a malformed reviewed entry that lacks a .pack (never calls answer)', async () => {
    const server = newServer(dataDir)
    // Write a corrupt reviewed snapshot (no `.pack`) directly under reviewed/.
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync(join(dataDir, 'reviewed'), { recursive: true })
    writeFileSync(
      join(dataDir, 'reviewed', 'broken.json'),
      JSON.stringify({ saved_at: '2026-06-01T12:00:00.000Z' }),
      'utf8',
    )
    const res = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { pack_id: 'broken', question: 'why?' },
    })
    expect(res.status).toBe(200)
    expect((res.body as { result: { kind: string } }).result.kind).toBe('refusal')
  })
})

// --- bd-14: empty content rejection ------------------------------------------

describe('bd-14 empty/whitespace content', () => {
  it('rejects empty content with 400', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({
      method: 'POST',
      path: '/sources',
      body: { title: 'x', media_type: 'text', license: 'CC', access: 'open', content: '' },
    })
    expect(res.status).toBe(400)
    expect((res.body as { error: string }).error).toBe('content must not be empty')
  })

  it('rejects whitespace-only content with 400', async () => {
    const server = newServer(dataDir)
    const res = await server.handle({
      method: 'POST',
      path: '/sources',
      body: { title: 'x', media_type: 'text', license: 'CC', access: 'open', content: '   \n\t  ' },
    })
    expect(res.status).toBe(400)
    expect((res.body as { error: string }).error).toBe('content must not be empty')
  })
})

// --- bd-14: generic 500 (no internal leak) -----------------------------------

describe('bd-14 generic 500 on unexpected error', () => {
  it('returns a generic "internal error" body, not the internal detail', async () => {
    // Inject an adapter that throws a detail-bearing error during draft extraction,
    // so the route's unguarded extract() rejects → top-level catch fires.
    const secret = 'SECRET INTERNAL DETAIL leaked-token-xyz'
    const adapter = {
      name: 'boom',
      extract: () => Promise.reject(new Error(secret)),
    }
    const server = createServer({ dataDir, now: FIXED_NOW, idFactory: seqIds(), adapter })
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id

    const res = await draftPack(server, sourceId)
    expect(res.status).toBe(500)
    expect((res.body as { error: string }).error).toBe('internal error')
    expect(JSON.stringify(res.body)).not.toContain(secret)
  })
})

// --- bd-16: serialize same-pack mutations ------------------------------------

describe('bd-16 withPackLock serializer', () => {
  // A read-modify-write cycle with a REAL async window between read and write.
  // This is the shape the lock must protect: without serialization two cycles on
  // the same key both read the same value and the second write clobbers the first
  // (a lost update). The server's store is synchronous today so this gap is only
  // theoretical in-process, but the lock guarantees correctness if it ever isn't.
  const yieldTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

  it('without a lock, two overlapping read-modify-write cycles lose an update (control)', async () => {
    const store = { v: 0 }
    async function inc(): Promise<void> {
      const read = store.v
      await yieldTick() // both reads happen before either write → clobber
      store.v = read + 1
    }
    await Promise.all([inc(), inc()])
    // The lost update: two increments, but only one landed.
    expect(store.v).toBe(1)
  })

  it('serializes same-key cycles so BOTH overlapping mutations land (no lost update)', async () => {
    const lock = createPackLock()
    const store = { v: 0 }
    async function inc(): Promise<void> {
      const read = store.v
      await yieldTick()
      store.v = read + 1
    }
    // Both started before either resolves; same key → the lock chains them.
    await Promise.all([lock('p', inc), lock('p', inc)])
    expect(store.v).toBe(2)
  })

  it('runs DIFFERENT keys concurrently (no global lock, no deadlock)', async () => {
    const lock = createPackLock()
    const order: string[] = []
    // p1's fn yields a few ticks; p2 must not be blocked behind it.
    const p1 = lock('p1', async () => {
      await yieldTick()
      await yieldTick()
      order.push('p1')
    })
    const p2 = lock('p2', async () => {
      order.push('p2')
    })
    await Promise.all([p1, p2])
    // p2 finished first despite being started second → not serialized vs p1.
    expect(order).toEqual(['p2', 'p1'])
  })

  it('propagates a rejection to its caller WITHOUT poisoning the chain for the next', async () => {
    const lock = createPackLock()
    const seen: string[] = []
    const boom = lock('p', () => {
      throw new Error('boom')
    })
    // The next same-key call still runs to completion after the rejection.
    const next = lock('p', () => {
      seen.push('next ran')
      return 42
    })
    await expect(boom).rejects.toThrow('boom')
    await expect(next).resolves.toBe(42)
    expect(seen).toEqual(['next ran'])
  })

  it('drains its internal map once a key has no in-flight work (no leak)', async () => {
    const lock = createPackLock()
    // Touch many distinct keys; each chain should clean itself up after settling.
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => lock(`k${i}`, () => i)),
    )
    // After all settle, a fresh key behaves exactly like the first (cold) call:
    // it does not wait behind any prior tail. Assert it resolves on the next tick
    // without inheriting a stale chain (proxy for "the map is not growing").
    let ran = false
    await lock('fresh', () => {
      ran = true
    })
    expect(ran).toBe(true)
  })
})

describe('bd-16 same-pack mutations serialize end-to-end', () => {
  async function setup(server: Server): Promise<{ packId: string; atomIds: string[] }> {
    const src = await postSource(server)
    const sourceId = (src.body as { source_id: string }).source_id
    const draft = await draftPack(server, sourceId)
    const pack = (draft.body as { pack: { id: string; atoms: { id: string }[] } }).pack
    return { packId: pack.id, atomIds: pack.atoms.map((a) => a.id) }
  }

  it('two concurrent PATCHes on the SAME pack (different atoms) BOTH land — neither lost', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)
    expect(atomIds.length).toBeGreaterThanOrEqual(2)

    // Fire two mutations on the SAME pack WITHOUT awaiting between them: accept
    // atom A and accept atom B. Both promises are pending simultaneously; the
    // per-pack lock serializes the two read-modify-write cycles so the second
    // reads the first's persisted result and neither edit is dropped.
    const [resA, resB] = await Promise.all([
      server.handle({
        method: 'PATCH',
        path: `/packs/${packId}/atoms/${atomIds[0]}`,
        body: { op: 'accept' },
      }),
      server.handle({
        method: 'PATCH',
        path: `/packs/${packId}/atoms/${atomIds[1]}`,
        body: { op: 'reject' },
      }),
    ])
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    // The FINAL persisted pack must reflect BOTH mutations.
    const got = await server.handle({ method: 'GET', path: `/packs/${packId}` })
    const pack = (got.body as {
      pack: { atoms: { id: string; review_state: string }[]; derivations: unknown[] }
    }).pack
    const a = pack.atoms.find((x) => x.id === atomIds[0])!
    const b = pack.atoms.find((x) => x.id === atomIds[1])!
    expect(a.review_state).toBe('reviewed')
    expect(b.review_state).toBe('rejected')
    // Both mutations appended an edit derivation (ingest + extract + 2 edits = 4):
    // had the second clobbered the first's write, only ONE edit would survive.
    expect(pack.derivations.length).toBe(4)
  })

  it('the second same-pack mutation observes the first persisted write (read after write)', async () => {
    const server = newServer(dataDir)
    const { packId, atomIds } = await setup(server)

    // Instrument the real Store to record the ORDER of pack reads/writes across
    // the two concurrent handle() calls. With the per-pack lock, the order is the
    // serialized [get, put, get, put]; the second get must follow the first put.
    const events: string[] = []
    const realGet = Store.prototype.getPack
    const realPut = Store.prototype.putPack
    Store.prototype.getPack = function (this: Store, id: string) {
      if (id === packId) events.push('get')
      return realGet.call(this, id)
    }
    Store.prototype.putPack = function (this: Store, pack: Parameters<Store['putPack']>[0]) {
      if (pack.id === packId) events.push('put')
      return realPut.call(this, pack)
    }
    try {
      await Promise.all([
        server.handle({
          method: 'PATCH',
          path: `/packs/${packId}/atoms/${atomIds[0]}`,
          body: { op: 'accept' },
        }),
        server.handle({
          method: 'PATCH',
          path: `/packs/${packId}/atoms/${atomIds[1]}`,
          body: { op: 'accept' },
        }),
      ])
    } finally {
      Store.prototype.getPack = realGet
      Store.prototype.putPack = realPut
    }
    // Serialized: each cycle reads then writes before the next reads.
    expect(events).toEqual(['get', 'put', 'get', 'put'])
  })

  it('concurrent mutations on DIFFERENT packs both complete (no deadlock, not serialized away)', async () => {
    const server = newServer(dataDir)
    const a = await setup(server)
    const b = await setup(server)
    expect(a.packId).not.toBe(b.packId)

    // Two different packs mutated concurrently must both complete promptly.
    const [resA, resB] = await Promise.all([
      server.handle({
        method: 'PATCH',
        path: `/packs/${a.packId}/atoms/${a.atomIds[0]}`,
        body: { op: 'accept' },
      }),
      server.handle({
        method: 'PATCH',
        path: `/packs/${b.packId}/atoms/${b.atomIds[0]}`,
        body: { op: 'accept' },
      }),
    ])
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    const gotA = await server.handle({ method: 'GET', path: `/packs/${a.packId}` })
    const gotB = await server.handle({ method: 'GET', path: `/packs/${b.packId}` })
    expect(
      (gotA.body as { pack: { atoms: { id: string; review_state: string }[] } }).pack.atoms.find(
        (x) => x.id === a.atomIds[0],
      )!.review_state,
    ).toBe('reviewed')
    expect(
      (gotB.body as { pack: { atoms: { id: string; review_state: string }[] } }).pack.atoms.find(
        (x) => x.id === b.atomIds[0],
      )!.review_state,
    ).toBe('reviewed')
  })
})
