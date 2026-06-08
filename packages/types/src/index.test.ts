import { describe, it, expect } from 'vitest'
import { SCHEMA_VERSION, type LearningPack, type Relationship } from './index.js'

// Type-level fixture: this object must compile against LearningPack. It mirrors
// the minimal shape the schema requires, so a drift between schema and types
// surfaces as a compile error here.
const fixture: LearningPack = {
  id: 'pack-1',
  title: 'Scaffold fixture pack',
  version: '0.1.0',
  schema_version: SCHEMA_VERSION,
  license: 'CC-BY-4.0',
  sources: [
    {
      id: 'src-1',
      uri: 'https://example.com/talk',
      media_type: 'video',
      title: 'A talk',
      license: 'creator-authorized',
      access: 'owned',
    },
  ],
  anchors: [
    {
      id: 'anc-1',
      source_asset_id: 'src-1',
      selector: { kind: 'timestamp_range', start: '0', end: '5000' },
      excerpt: 'spaced repetition works',
      extraction_method: 'asr',
      verifiable: true,
    },
  ],
  atoms: [
    {
      id: 'atom-1',
      kind: 'claim',
      title: 'Spacing improves retention',
      review_state: 'generated',
      authored_by: 'ai',
      anchors: [{ anchor_id: 'anc-1', support_state: 'supports' }],
      derivation_id: 'der-1',
      version: 1,
    },
  ],
  relationships: [
    {
      id: 'rel-1',
      from_atom_id: 'atom-1',
      to_atom_id: 'atom-1',
      predicate: 'explains',
      review_state: 'generated',
    },
  ],
  derivations: [
    {
      id: 'der-1',
      op: 'extract',
      actor: 'ai',
      schema_version: SCHEMA_VERSION,
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
}

// Type-level check: a relationship WITH anchor_ids must also carry support_state
// (the schema's dependentRequired invariant, enforced by the discriminated union).
const anchoredEdge: Relationship = {
  id: 'rel-2',
  from_atom_id: 'atom-1',
  to_atom_id: 'atom-1',
  predicate: 'supports',
  review_state: 'reviewed',
  anchor_ids: ['anc-1'],
  support_state: 'supports',
}

describe('@sam/types', () => {
  it('exposes SCHEMA_VERSION "0"', () => {
    expect(SCHEMA_VERSION).toBe('0')
  })

  it('compiles the LearningPack v0 fixture', () => {
    expect(fixture.atoms[0]?.kind).toBe('claim')
    expect(fixture.sources).toHaveLength(1)
  })

  it('enforces support_state on anchored relationships at the type level', () => {
    expect(anchoredEdge.support_state).toBe('supports')
  })
})
