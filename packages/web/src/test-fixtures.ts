/**
 * Shared test fixtures: a small but complete draft LearningPack and helpers.
 * Used by the component/interaction tests (the real API is mocked; no network).
 */
import type { LearningPack, SourceAnchor, Atom, Relationship } from '@sam/types'
import type { ValidationResult } from './api'

export function anchor(id: string, excerpt: string, verifiable = true): SourceAnchor {
  return {
    id,
    source_asset_id: 'src-1',
    selector: { kind: 'text_quote', start: '0', end: String(excerpt.length) },
    excerpt,
    extraction_method: 'native',
    verifiable,
  }
}

export function atom(over: Partial<Atom> & Pick<Atom, 'id' | 'kind' | 'title'>): Atom {
  return {
    summary: `${over.title} summary`,
    review_state: 'generated',
    authored_by: 'ai',
    anchors: [],
    derivation_id: 'der-extract',
    version: 1,
    ...over,
  }
}

export function makeDraftPack(): LearningPack {
  const a1 = atom({
    id: 'atom-1',
    kind: 'system',
    title: 'Spaced Repetition',
    anchors: [{ anchor_id: 'anc-1', support_state: 'partially' }],
  })
  const a2 = atom({
    id: 'atom-2',
    kind: 'model',
    title: 'Forgetting Curve',
    anchors: [{ anchor_id: 'anc-2', support_state: 'supports' }],
  })
  const a3 = atom({ id: 'atom-3', kind: 'claim', title: 'Review beats cramming' })

  const rel: Relationship = {
    id: 'rel-1',
    from_atom_id: 'atom-1',
    to_atom_id: 'atom-2',
    predicate: 'uses',
    review_state: 'generated',
  }

  return {
    id: 'pack-1',
    title: 'Pack: Learning',
    version: '0.1.0',
    schema_version: '0',
    license: 'CC-BY-4.0',
    sources: [
      {
        id: 'src-1',
        uri: 'inline:Learning',
        media_type: 'markdown',
        title: 'Learning',
        license: 'CC-BY-4.0',
        access: 'owned',
      },
    ],
    anchors: [anchor('anc-1', 'spacing improves retention'), anchor('anc-2', 'memory decays over time')],
    atoms: [a1, a2, a3],
    relationships: [rel],
    derivations: [
      {
        id: 'der-extract',
        op: 'extract',
        actor: 'ai',
        schema_version: '0',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  }
}

export const validResult: ValidationResult = { ok: true, errors: [] }

export const structuralResult: ValidationResult = {
  ok: false,
  errors: [
    {
      code: 'structural',
      path: '/atoms/0/title',
      message: 'title must be a non-empty string',
      severity: 'structural',
    },
    {
      code: 'publish_without_supporting_anchor',
      path: 'atoms.0',
      message: 'a published atom needs a supporting anchor',
      severity: 'graph',
    },
  ],
}

export const graphOnlyResult: ValidationResult = {
  ok: false,
  errors: [
    {
      code: 'publish_without_supporting_anchor',
      path: 'atoms.2',
      message: 'claim has no supporting anchor yet',
      severity: 'graph',
    },
  ],
}
