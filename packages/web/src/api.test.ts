import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from './api'

/**
 * API-client tests: mock `global.fetch` and assert the client hits the correct
 * bd-7 endpoint with the correct method/body, and maps statuses (201 vs 409,
 * 422) to the right domain results. No real network/server.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Parse the [url, init] of the most recent fetch call. */
function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return { url: String(url), init: (init ?? {}) as RequestInit }
}

describe('apiBase', () => {
  it('defaults to the server localhost bind', () => {
    expect(api.apiBase()).toBe('http://127.0.0.1:8787')
  })
})

describe('mutations', () => {
  it('acceptAtom PATCHes the atom with op:accept', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { pack: { id: 'p' }, validation: { ok: true, errors: [] } }))
    await api.acceptAtom('p1', 'a1')
    const { url, init } = lastCall()
    expect(url).toBe('http://127.0.0.1:8787/packs/p1/atoms/a1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ op: 'accept' })
  })

  it('editAtom sends op:edit + patch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { pack: { id: 'p' }, validation: { ok: true, errors: [] } }))
    await api.editAtom('p1', 'a1', { title: 'X', summary: 'Y' })
    const { init } = lastCall()
    expect(JSON.parse(String(init.body))).toEqual({ op: 'edit', patch: { title: 'X', summary: 'Y' } })
  })

  it('setSupport sends op:set_support with anchor_id + support_state', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { pack: { id: 'p' }, validation: { ok: true, errors: [] } }))
    await api.setSupport('p1', 'a1', 'anc-9', 'supports')
    const { init } = lastCall()
    expect(JSON.parse(String(init.body))).toEqual({
      op: 'set_support',
      anchor_id: 'anc-9',
      support_state: 'supports',
    })
  })

  it('splitAtom POSTs to the split route and returns new_atom_id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { pack: { id: 'p' }, validation: { ok: true, errors: [] }, new_atom_id: 'a2' }),
    )
    const res = await api.splitAtom('p1', 'a1')
    expect(lastCall().url).toBe('http://127.0.0.1:8787/packs/p1/atoms/a1/split')
    expect(res.new_atom_id).toBe('a2')
  })

  it('throws ApiError on a 422 structural rejection', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, { error: 'invalid', validation: { ok: false, errors: [] } }))
    await expect(api.acceptAtom('p1', 'a1')).rejects.toBeInstanceOf(api.ApiError)
  })
})

describe('saveReviewed', () => {
  it('maps 201 to {ok:true, reviewed}', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { reviewed: { pack: { id: 'p' }, saved_at: 't' } }))
    const res = await api.saveReviewed('p1')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.reviewed.saved_at).toBe('t')
    expect(lastCall().url).toBe('http://127.0.0.1:8787/packs/p1/reviewed')
  })

  it('maps 409 to {ok:false, validation} without throwing', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { validation: { ok: false, errors: [{ code: 'x', path: 'p', message: 'm', severity: 'structural' }] } }),
    )
    const res = await api.saveReviewed('p1')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.validation.errors[0]?.severity).toBe('structural')
  })
})

describe('createSourceAndDraft', () => {
  it('POSTs /sources then /packs/draft with the source id', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { source_id: 'src-9', source: {}, anchors: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { pack_id: 'p9', pack: { id: 'p9' }, validation: { ok: true, errors: [] } }))

    const draft = await api.createSourceAndDraft({
      title: 'T',
      media_type: 'markdown',
      license: 'CC-BY-4.0',
      access: 'owned',
      content: 'hello',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://127.0.0.1:8787/sources')
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toMatchObject({
      title: 'T',
      media_type: 'markdown',
      access: 'owned',
    })
    expect(String(fetchMock.mock.calls[1]![0])).toBe('http://127.0.0.1:8787/packs/draft')
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({
      source_id: 'src-9',
    })
    expect(draft.pack_id).toBe('p9')
  })
})

describe('tutorQuery', () => {
  it('POSTs /tutor/query and unwraps result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result: { kind: 'refusal', reason: 'no pack' } }))
    const res = await api.tutorQuery('p1', 'q')
    expect(lastCall().url).toBe('http://127.0.0.1:8787/tutor/query')
    expect(res).toEqual({ kind: 'refusal', reason: 'no pack' })
  })
})
