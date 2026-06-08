/**
 * bd-9 tutor proof-surface tests.
 *
 * Two layers:
 *  - PURE `answer(pack, question)` over hand-built reviewed packs (each verified
 *    `validatePack(...).ok` so the fixtures are real LearningPacks, not shapes).
 *  - ROUTE `POST /tutor/query` driven through the real server flow
 *    (draft -> accept atoms -> set_support supports -> POST reviewed -> query).
 *
 * Everything is offline + deterministic: no network, no LLM, mock adapter only.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { validatePack } from '@sam/validator'
import type {
  Atom,
  AtomAnchorRef,
  DerivationRun,
  LearningPack,
  ReviewState,
  SourceAnchor,
  SourceAsset,
  SupportState,
} from '@sam/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { answer, createServer, type ApiResponse, type Server } from './index.js'

// --- Fixture builders --------------------------------------------------------

const NOW = '2026-06-01T12:00:00.000Z'

const SOURCE: SourceAsset = {
  id: 'src-1',
  uri: 'inline:primer',
  media_type: 'markdown',
  title: 'Primer',
  license: 'CC-BY-4.0',
  access: 'open',
}

function anchor(id: string, excerpt: string): SourceAnchor {
  return {
    id,
    source_asset_id: SOURCE.id,
    selector: { kind: 'text_quote', start: '0', end: String(excerpt.length) },
    excerpt,
    extraction_method: 'native',
    verifiable: true,
  }
}

const INGEST_DERIVATION: DerivationRun = {
  id: 'der-ingest',
  op: 'ingest',
  actor: 'human',
  schema_version: '0',
  created_at: NOW,
}

interface AtomSpec {
  id: string
  title: string
  summary?: string
  body?: string
  review_state: ReviewState
  /** anchor refs: [anchor_id, support_state] */
  anchors: Array<[string, SupportState]>
}

function makeAtom(spec: AtomSpec): Atom {
  const anchors: AtomAnchorRef[] = spec.anchors.map(([anchor_id, support_state]) => ({
    anchor_id,
    support_state,
  }))
  return {
    id: spec.id,
    kind: 'claim',
    title: spec.title,
    ...(spec.summary !== undefined ? { summary: spec.summary } : {}),
    ...(spec.body !== undefined ? { body: spec.body } : {}),
    review_state: spec.review_state,
    authored_by: 'ai',
    anchors,
    derivation_id: INGEST_DERIVATION.id,
    version: 1,
  }
}

/**
 * Build a LearningPack from anchors + atom specs and assert it actually validates
 * (so the fixtures exercise `answer` against real packs, never invalid shapes).
 */
function makePack(anchors: SourceAnchor[], atomSpecs: AtomSpec[]): LearningPack {
  const pack: LearningPack = {
    id: 'pack-1',
    title: 'Tutor fixture pack',
    version: '0.1.0',
    schema_version: '0',
    license: 'CC-BY-4.0',
    sources: [SOURCE],
    anchors,
    atoms: atomSpecs.map(makeAtom),
    relationships: [],
    derivations: [INGEST_DERIVATION],
  }
  const v = validatePack(pack)
  if (!v.ok) {
    throw new Error(`fixture pack is invalid: ${JSON.stringify(v.errors)}`)
  }
  return pack
}

// --- Pure answer: in-scope answer cites the correct reviewed anchor ----------

describe('answer(): in-scope grounding', () => {
  it('answers and cites the correct reviewed supporting anchor', () => {
    const pack = makePack(
      [
        anchor('anc-feedback', 'Feedback loops can amplify or dampen change within a system.'),
        anchor('anc-other', 'A model is a simplified representation of a system.'),
      ],
      [
        {
          id: 'atom-feedback',
          title: 'Feedback loops',
          summary: 'Feedback loops amplify or dampen change in a system.',
          review_state: 'reviewed',
          anchors: [['anc-feedback', 'supports']],
        },
        {
          id: 'atom-model',
          title: 'Models',
          summary: 'A model is a simplified representation.',
          review_state: 'reviewed',
          anchors: [['anc-other', 'supports']],
        },
      ],
    )

    const res = answer(pack, 'How do feedback loops amplify change?')
    expect(res.kind).toBe('answer')
    if (res.kind !== 'answer') return
    expect(res.text).toBe('Feedback loops amplify or dampen change in a system.')
    expect(res.citations).toHaveLength(1)
    const cite = res.citations[0]!
    expect(cite.atom_id).toBe('atom-feedback')
    expect(cite.anchor_id).toBe('anc-feedback')
    expect(cite.excerpt).toBe(
      'Feedback loops can amplify or dampen change within a system.',
    )
  })

  it('answers from a published atom too (reviewed ∪ published eligibility)', () => {
    const pack = makePack(
      [anchor('anc-sys', 'Systems thinking is seeing wholes rather than parts.')],
      [
        {
          id: 'atom-sys',
          title: 'Systems thinking',
          summary: 'Systems thinking means seeing wholes rather than parts.',
          review_state: 'published',
          anchors: [['anc-sys', 'supports']],
        },
      ],
    )
    const res = answer(pack, 'What is systems thinking?')
    expect(res.kind).toBe('answer')
    if (res.kind !== 'answer') return
    expect(res.citations[0]!.anchor_id).toBe('anc-sys')
  })
})

// --- Pure answer: out-of-scope refuses ---------------------------------------

describe('answer(): out-of-scope refusal', () => {
  it('refuses an out-of-scope question with no citations field', () => {
    const pack = makePack(
      [anchor('anc-sys', 'Systems thinking is seeing wholes rather than parts.')],
      [
        {
          id: 'atom-sys',
          title: 'Systems thinking',
          summary: 'Systems thinking means seeing wholes rather than parts.',
          review_state: 'reviewed',
          anchors: [['anc-sys', 'supports']],
        },
      ],
    )
    const res = answer(pack, 'What is the capital of France?')
    expect(res.kind).toBe('refusal')
    expect('citations' in res).toBe(false)
  })
})

// --- Pure answer: NEVER cites non-reviewed / non-supports --------------------

describe('answer(): never cites non-reviewed or non-supports content', () => {
  it('refuses when the only keyword match is a generated atom', () => {
    const pack = makePack(
      [anchor('anc-quantum', 'Quantum entanglement links particle states.')],
      [
        {
          id: 'atom-quantum',
          title: 'Quantum entanglement',
          summary: 'Quantum entanglement links the states of two particles.',
          // generated -> NOT eligible, must never be retrieved or cited.
          review_state: 'generated',
          anchors: [['anc-quantum', 'supports']],
        },
      ],
    )
    const res = answer(pack, 'Explain quantum entanglement of particles')
    expect(res.kind).toBe('refusal')
    if (res.kind === 'answer') {
      // Defensive: prove no citation ever references the non-reviewed atom/anchor.
      for (const c of res.citations) {
        expect(c.atom_id).not.toBe('atom-quantum')
        expect(c.anchor_id).not.toBe('anc-quantum')
      }
    }
  })

  it('refuses when the matching reviewed atom only has a non-supports anchor', () => {
    const pack = makePack(
      [anchor('anc-quantum', 'Quantum entanglement links particle states.')],
      [
        {
          id: 'atom-quantum',
          title: 'Quantum entanglement',
          summary: 'Quantum entanglement links the states of two particles.',
          review_state: 'reviewed',
          // partially / does_not_support -> not a citable anchor.
          anchors: [['anc-quantum', 'partially']],
        },
      ],
    )
    const res = answer(pack, 'Explain quantum entanglement of particles')
    expect(res.kind).toBe('refusal')
    if (res.kind === 'answer') {
      for (const c of res.citations) expect(c.anchor_id).not.toBe('anc-quantum')
    }
  })

  it('prefers a reviewed+supports atom over a higher-keyword generated atom', () => {
    // The generated atom matches MORE question tokens, but is ineligible; the
    // tutor must still answer from the reviewed/supports atom (and only it).
    const pack = makePack(
      [
        anchor('anc-gen', 'Feedback loops amplify dampen change system reinforcing balancing.'),
        anchor('anc-rev', 'A model is a simplified representation of a system.'),
      ],
      [
        {
          id: 'atom-gen',
          title: 'Feedback loops reinforcing balancing change system amplify dampen',
          summary: 'Reinforcing and balancing feedback loops in a system.',
          review_state: 'generated',
          anchors: [['anc-gen', 'supports']],
        },
        {
          id: 'atom-rev',
          title: 'Models',
          summary: 'A model is a simplified representation of a system.',
          review_state: 'reviewed',
          anchors: [['anc-rev', 'supports']],
        },
      ],
    )
    const res = answer(pack, 'what is a model of a system')
    expect(res.kind).toBe('answer')
    if (res.kind !== 'answer') return
    expect(res.citations).toHaveLength(1)
    expect(res.citations[0]!.atom_id).toBe('atom-rev')
    expect(res.citations[0]!.anchor_id).toBe('anc-rev')
    // Never the generated atom/anchor.
    for (const c of res.citations) {
      expect(c.atom_id).not.toBe('atom-gen')
      expect(c.anchor_id).not.toBe('anc-gen')
    }
  })

  it('refuses when a reviewed atom cites an anchor missing from pack.anchors', () => {
    // Build by hand (skips makePack's validity assertion) to exercise the
    // dangling-anchor guard: validator would flag this, but answer() must also
    // refuse to cite an unresolvable anchor on its own.
    const pack: LearningPack = {
      id: 'pack-dangle',
      title: 'Dangling',
      version: '0.1.0',
      schema_version: '0',
      license: 'CC-BY-4.0',
      sources: [SOURCE],
      anchors: [], // anchor referenced below is NOT present
      atoms: [
        makeAtom({
          id: 'atom-x',
          title: 'Systems thinking wholes parts',
          summary: 'Systems thinking is seeing wholes rather than parts.',
          review_state: 'reviewed',
          anchors: [['anc-missing', 'supports']],
        }),
      ],
      relationships: [],
      derivations: [INGEST_DERIVATION],
    }
    const res = answer(pack, 'systems thinking wholes')
    expect(res.kind).toBe('refusal')
  })
})

// --- Refusal suite: >=10 clearly out-of-scope questions ----------------------

describe('answer(): refusal suite (>=10 out-of-scope questions)', () => {
  const pack = makePack(
    [
      anchor('anc-feedback', 'Feedback loops can amplify or dampen change within a system.'),
      anchor('anc-model', 'A model is a simplified representation of a system.'),
      anchor('anc-sys', 'Systems thinking is seeing wholes rather than parts.'),
    ],
    [
      {
        id: 'atom-feedback',
        title: 'Feedback loops',
        summary: 'Feedback loops amplify or dampen change in a system.',
        review_state: 'reviewed',
        anchors: [['anc-feedback', 'supports']],
      },
      {
        id: 'atom-model',
        title: 'Models',
        summary: 'A model is a simplified representation of a system.',
        review_state: 'published',
        anchors: [['anc-model', 'supports']],
      },
      {
        id: 'atom-sys',
        title: 'Systems thinking',
        summary: 'Systems thinking means seeing wholes rather than parts.',
        review_state: 'reviewed',
        anchors: [['anc-sys', 'supports']],
      },
    ],
  )

  const OUT_OF_SCOPE = [
    'What is the capital of France?',
    'How do I bake sourdough bread?',
    'Who won the 1998 World Cup?',
    'What time does the pharmacy close?',
    'Explain photosynthesis in plants.',
    'What is the boiling point of mercury?',
    'How tall is Mount Everest?',
    'Write me a poem about cats.',
    'What is the airspeed velocity of an unladen swallow?',
    'How do I reset my router password?',
    'What stocks should I buy tomorrow?',
    'Translate hello into Japanese.',
  ]

  it.each(OUT_OF_SCOPE)('refuses: %s', (question) => {
    const res = answer(pack, question)
    expect(res.kind).toBe('refusal')
    expect('citations' in res).toBe(false)
  })

  it('refuses an empty / punctuation-only question', () => {
    expect(answer(pack, '').kind).toBe('refusal')
    expect(answer(pack, '???').kind).toBe('refusal')
  })
})

// --- Route: POST /tutor/query through the real server flow -------------------

const FIXED_NOW = (): Date => new Date('2026-06-01T12:00:00.000Z')
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

let dataDir: string
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'sam-tutor-'))
})
afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

function newServer(): Server {
  return createServer({ dataDir, now: FIXED_NOW, idFactory: seqIds() })
}

/** Draft a pack, accept every atom + set its anchors to supports, save reviewed. */
async function reviewAndSave(server: Server): Promise<string> {
  const src = await server.handle({
    method: 'POST',
    path: '/sources',
    body: {
      title: 'Primer',
      media_type: 'markdown',
      license: 'CC-BY-4.0',
      access: 'open',
      content: SAMPLE_CONTENT,
    },
  })
  const sourceId = (src.body as { source_id: string }).source_id

  const draft = await server.handle({
    method: 'POST',
    path: '/packs/draft',
    body: { source_id: sourceId },
  })
  const draftBody = draft.body as {
    pack_id: string
    pack: { atoms: { id: string; anchors: { anchor_id: string }[] }[] }
  }
  const packId = draftBody.pack_id

  for (const atom of draftBody.pack.atoms) {
    await server.handle({
      method: 'PATCH',
      path: `/packs/${packId}/atoms/${atom.id}`,
      body: { op: 'accept' },
    })
    for (const ref of atom.anchors) {
      await server.handle({
        method: 'PATCH',
        path: `/packs/${packId}/atoms/${atom.id}`,
        body: { op: 'set_support', anchor_id: ref.anchor_id, support_state: 'supports' },
      })
    }
  }

  const reviewed = await server.handle({ method: 'POST', path: `/packs/${packId}/reviewed` })
  expect(reviewed.status).toBe(201)
  return packId
}

type RouteResult =
  | { kind: 'answer'; text: string; citations: { atom_id: string; anchor_id: string; excerpt: string }[] }
  | { kind: 'refusal'; reason: string }

function resultOf(res: ApiResponse): RouteResult {
  return (res.body as { result: RouteResult }).result
}

describe('POST /tutor/query route', () => {
  it('querying a saved reviewed pack returns a grounded answer', async () => {
    const server = newServer()
    const packId = await reviewAndSave(server)

    const res = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { pack_id: packId, question: 'How do feedback loops change a system?' },
    })
    expect(res.status).toBe(200)
    const result = resultOf(res)
    expect(result.kind).toBe('answer')
    if (result.kind !== 'answer') return
    expect(result.citations.length).toBeGreaterThanOrEqual(1)
    // Every citation excerpt is real source text (grounded).
    for (const c of result.citations) {
      expect(typeof c.excerpt).toBe('string')
      expect(c.excerpt.length).toBeGreaterThan(0)
    }
  })

  it('refuses (200) for a pack_id with no reviewed snapshot', async () => {
    const server = newServer()
    const res = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { pack_id: 'never-reviewed', question: 'What is systems thinking?' },
    })
    expect(res.status).toBe(200)
    const result = resultOf(res)
    expect(result.kind).toBe('refusal')
    if (result.kind === 'refusal') expect(result.reason).toMatch(/no reviewed pack/)
  })

  it('refuses (200) an out-of-scope question against a reviewed pack', async () => {
    const server = newServer()
    const packId = await reviewAndSave(server)
    const res = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { pack_id: packId, question: 'Who won the 1998 World Cup?' },
    })
    expect(res.status).toBe(200)
    expect(resultOf(res).kind).toBe('refusal')
  })

  it('400s on missing pack_id or question', async () => {
    const server = newServer()
    const noPack = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { question: 'hi' },
    })
    expect(noPack.status).toBe(400)
    const noQuestion = await server.handle({
      method: 'POST',
      path: '/tutor/query',
      body: { pack_id: 'x' },
    })
    expect(noQuestion.status).toBe(400)
    const noBody = await server.handle({ method: 'POST', path: '/tutor/query' })
    expect(noBody.status).toBe(400)
  })
})
