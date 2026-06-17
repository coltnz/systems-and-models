/**
 * bd-10 — end-to-end ALPHA WALKTHROUGH (Vitest, runs in the `npm test` gate).
 *
 * Drives the REAL `@sam/server` request core with the default MOCK adapter over
 * a temp dataDir and a fixed clock/id sequence. Proves the whole alpha loop
 * offline: source -> draft (validates) -> review -> reviewed snapshot ->
 * tutor cites in-scope / refuses out-of-scope. Also asserts the committed
 * example artifacts (`examples/*.json`) match this deterministic run and that
 * both validate against `spec/learning-pack.schema.json` via `@sam/validator`.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SCHEMA_VERSION } from '@sam/types'
import { validatePack } from '@sam/validator'
import { getAdapter } from '@sam/extraction'
import { createServer, type LearningPack } from '@sam/server'

import {
  DEMO_FIXTURE,
  IN_SCOPE_QUESTION,
  OUT_OF_SCOPE_QUESTION,
  loadDemoSource,
  runWalkthrough,
  type WalkthroughResult,
} from './walkthrough.js'

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples')

function readExample(name: string): LearningPack {
  return JSON.parse(readFileSync(join(examplesDir, name), 'utf8')) as LearningPack
}

let dataDir: string
let result: WalkthroughResult

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'sam-e2e-'))
  result = await runWalkthrough(dataDir)
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

describe('alpha walkthrough (offline, mock adapter)', () => {
  it('wires every workspace package together (smoke)', () => {
    expect(SCHEMA_VERSION).toBe('0')
    expect(validatePack({}).ok).toBe(false)
    expect(createServer({ adapter: getAdapter() }).adapter.name).toBe('mock')
  })

  it('ingests the demo source into a source + multiple verifiable anchors', () => {
    // The demo fixture is split into SENTENCES (bd-17) -> several anchors
    // (paragraph blocks of multiple sentences each yield one anchor per sentence).
    expect(result.anchorCount).toBeGreaterThanOrEqual(2)
    expect(result.sourceId).toMatch(/^src-/)
    // The license travels in metadata; the ingested body has no header comment.
    expect(loadDemoSource().startsWith('<!--')).toBe(false)
  })

  it('generates a draft Learning Pack that validates and has atoms', () => {
    expect(result.draftValidationOk).toBe(true)
    expect(result.draftPack.atoms.length).toBeGreaterThanOrEqual(1)
    expect(validatePack(result.draftPack).ok).toBe(true)
    // The model atom we will cite exists and is anchored.
    const model = result.draftPack.atoms.find((a) => a.id === result.modelAtomId)!
    expect(model.kind).toBe('model')
    expect(model.anchors.length).toBeGreaterThanOrEqual(1)
  })

  it('saves a reviewed snapshot: model atom reviewed+supports, others rejected', () => {
    expect(result.reviewedSavedAt).toBe('2026-06-01T12:00:00.000Z')
    expect(validatePack(result.reviewedPack).ok).toBe(true)
    const model = result.reviewedPack.atoms.find((a) => a.id === result.modelAtomId)!
    expect(model.review_state).toBe('reviewed')
    expect(model.anchors.some((r) => r.support_state === 'supports')).toBe(true)
    // Every non-model atom was rejected during review.
    for (const atom of result.reviewedPack.atoms) {
      if (atom.id === result.modelAtomId) continue
      expect(atom.review_state).toBe('rejected')
    }
  })

  it('answers an IN-SCOPE tutor question, citing a reviewed anchor', () => {
    expect(result.inScopeQuestion).toBe(IN_SCOPE_QUESTION)
    expect(result.inScope.kind).toBe('answer')
    if (result.inScope.kind !== 'answer') return
    expect(result.inScope.citations.length).toBeGreaterThanOrEqual(1)
    const cite = result.inScope.citations[0]!
    // The cited atom is the reviewed model atom, and the excerpt is the reviewed
    // anchor's text (present in the reviewed pack's anchors).
    expect(cite.atom_id).toBe(result.modelAtomId)
    const anchor = result.reviewedPack.anchors.find((a) => a.id === cite.anchor_id)!
    expect(anchor).toBeDefined()
    expect(cite.excerpt).toBe(anchor.excerpt)
  })

  it('REFUSES an OUT-OF-SCOPE tutor question (no fabricated citation)', () => {
    expect(result.outOfScopeQuestion).toBe(OUT_OF_SCOPE_QUESTION)
    expect(result.outOfScope.kind).toBe('refusal')
  })

  it('is deterministic: a second run over a fresh dir is byte-identical', async () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'sam-e2e-2-'))
    try {
      const again = await runWalkthrough(dir2)
      expect(JSON.stringify(again.draftPack)).toBe(JSON.stringify(result.draftPack))
      expect(JSON.stringify(again.reviewedPack)).toBe(JSON.stringify(result.reviewedPack))
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })
})

describe('committed example artifacts', () => {
  it(`fixtures/${DEMO_FIXTURE} carries a CC license header`, () => {
    const raw = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', DEMO_FIXTURE),
      'utf8',
    )
    expect(raw).toContain('CC-BY-4.0')
  })

  it('examples/draft-pack.json matches the deterministic run and validates', () => {
    const committed = readExample('draft-pack.json')
    expect(validatePack(committed).ok).toBe(true)
    expect(committed).toEqual(result.draftPack)
  })

  it('examples/reviewed-pack.json matches the deterministic run and validates', () => {
    const committed = readExample('reviewed-pack.json')
    expect(validatePack(committed).ok).toBe(true)
    expect(committed).toEqual(result.reviewedPack)
  })
})
