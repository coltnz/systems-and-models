import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import {
  isTraversable,
  traversableEdges,
  validatePack,
  type LearningPack,
  type ValidationCode,
  type ValidationError,
} from './index.js'

// --- Load the committed example pack as the valid baseline ------------------

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    try {
      readFileSync(join(dir, 'spec', 'learning-pack.schema.json'))
      return dir
    } catch {
      const parent = dirname(dir)
      if (parent === dir) throw new Error('repo root not found from test')
      dir = parent
    }
  }
}

const EXAMPLE_PATH = join(
  repoRoot(),
  'spec',
  'examples',
  'spaced-repetition-talk.learning-pack.json',
)

function loadExample(): LearningPack {
  return JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8')) as LearningPack
}

/** Deep clone so each test mutates an isolated copy. */
function clone<T>(value: T): T {
  return structuredClone(value)
}

function codes(errors: ValidationError[]): ValidationCode[] {
  return errors.map((e) => e.code)
}

// --- Happy path -------------------------------------------------------------

describe('@sam/validator — example pack', () => {
  it('validates the committed example pack with zero errors', () => {
    const result = validatePack(loadExample())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })
})

// --- Structural validation --------------------------------------------------

describe('@sam/validator — structural (Ajv)', () => {
  it('flags a missing required top-level field as structural', () => {
    const pack = clone(loadExample()) as Partial<LearningPack>
    delete pack.atoms
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.severity === 'structural')).toBe(true)
    expect(result.errors.every((e) => e.code === 'structural')).toBe(true)
  })

  it('flags schema_version != "0" as structural', () => {
    const pack = clone(loadExample()) as unknown as Record<string, unknown>
    pack.schema_version = '1'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.severity).toBe('structural')
    expect(result.errors[0]?.code).toBe('structural')
  })

  it('rejects a non-object input structurally', () => {
    const result = validatePack(null)
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.severity).toBe('structural')
  })
})

// --- Graph: referential integrity & uniqueness ------------------------------

describe('@sam/validator — referential integrity', () => {
  it('flags a dangling atom -> anchor reference', () => {
    const pack = clone(loadExample())
    pack.atoms[0].anchors[0].anchor_id = 'anc-does-not-exist'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(codes(result.errors)).toContain('dangling_atom_anchor_ref')
  })

  it('flags a dangling anchor -> source reference', () => {
    const pack = clone(loadExample())
    pack.anchors[0].source_asset_id = 'src-missing'
    const result = validatePack(pack)
    expect(codes(result.errors)).toContain('dangling_anchor_source_ref')
  })

  it('flags a dangling atom -> derivation reference', () => {
    const pack = clone(loadExample())
    pack.atoms[0].derivation_id = 'der-missing'
    const result = validatePack(pack)
    expect(codes(result.errors)).toContain('dangling_atom_derivation_ref')
  })

  it('flags a relationship referencing a missing atom', () => {
    const pack = clone(loadExample())
    pack.relationships[0].to_atom_id = 'atom-missing'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(codes(result.errors)).toContain('dangling_relationship_atom_ref')
  })

  it('flags a duplicate id within a collection', () => {
    const pack = clone(loadExample())
    pack.anchors.push(clone(pack.anchors[0]))
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(codes(result.errors)).toContain('duplicate_id')
  })
})

// --- Graph: publish invariant -----------------------------------------------

describe('@sam/validator — publish invariant', () => {
  it('flags a published atom with no supporting anchor', () => {
    const pack = clone(loadExample())
    // atoms[0] is published with support_state "supports"; downgrade it.
    pack.atoms[0].anchors[0].support_state = 'partially'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(codes(result.errors)).toContain('publish_without_supporting_anchor')
  })

  it('flags a published atom whose only supporting anchor is dangling', () => {
    const pack = clone(loadExample())
    pack.atoms[0].anchors[0].anchor_id = 'anc-missing'
    const result = validatePack(pack)
    // both the dangling ref and the publish invariant fire.
    expect(codes(result.errors)).toContain('publish_without_supporting_anchor')
    expect(codes(result.errors)).toContain('dangling_atom_anchor_ref')
  })
})

// --- Graph: relationship anchor/support dependency --------------------------

describe('@sam/validator — relationship anchor/support dependency', () => {
  it('flags anchor_ids present without support_state', () => {
    const pack = clone(loadExample())
    const rel = pack.relationships[1] as unknown as Record<string, unknown>
    rel.anchor_ids = ['anc-edge']
    delete rel.support_state
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    // The schema's `dependentRequired: { anchor_ids: ["support_state"] }` catches
    // this at the STRUCTURAL layer, which runs (and short-circuits) before the
    // graph layer — so the dependency is enforced as a structural error here. The
    // graph-level `relationship_anchor_without_support_state` mirror is kept as
    // defense-in-depth for any future schema that drops the constraint; the graph
    // relationship branch itself is exercised by the empty/dangling anchor_ids
    // tests below.
    expect(result.errors.some((e) => e.severity === 'structural')).toBe(true)
  })

  it('flags a dangling relationship anchor_id', () => {
    const pack = clone(loadExample())
    const rel = pack.relationships[1]
    if (rel.anchor_ids) rel.anchor_ids[0] = 'anc-missing'
    const result = validatePack(pack)
    expect(codes(result.errors)).toContain('dangling_relationship_anchor_ref')
  })

  it('flags empty anchor_ids array via graph check', () => {
    // Build a relationship with an empty anchor_ids + support_state so it passes
    // the schema (dependentRequired satisfied) but fails the non-empty rule.
    const pack = clone(loadExample())
    const rel = pack.relationships[1] as unknown as Record<string, unknown>
    rel.anchor_ids = []
    rel.support_state = 'supports'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(codes(result.errors)).toContain('relationship_empty_anchor_ids')
  })
})

// --- Graph: datetime --------------------------------------------------------

describe('@sam/validator — datetime tolerance', () => {
  it('flags a naive/zoneless created_at', () => {
    const pack = clone(loadExample())
    pack.derivations[0].created_at = '2026-05-26T10:00:00'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    expect(codes(result.errors)).toContain('derivation_created_at_not_tz_aware')
  })

  it('accepts a numeric offset created_at', () => {
    const pack = clone(loadExample())
    pack.derivations[0].created_at = '2026-05-26T10:00:00+02:00'
    const result = validatePack(pack)
    expect(result.ok).toBe(true)
  })

  it('rejects an impossible calendar instant even with Z', () => {
    const pack = clone(loadExample())
    pack.derivations[0].created_at = '2026-13-99T10:00:00Z'
    const result = validatePack(pack)
    expect(result.ok).toBe(false)
    // structural date-time format catches the bad calendar value first.
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

// --- Reviewed-only traversal ------------------------------------------------

describe('@sam/validator — traversableEdges', () => {
  it('returns only reviewed edges', () => {
    const pack = clone(loadExample())
    // Mark one edge non-reviewed; it must be filtered out.
    pack.relationships[0].review_state = 'generated'
    const edges = traversableEdges(pack)
    expect(edges.length).toBe(pack.relationships.length - 1)
    expect(edges.every((e) => e.review_state === 'reviewed')).toBe(true)
    expect(edges.some((e) => e.id === pack.relationships[0].id)).toBe(false)
  })

  it('isTraversable agrees with the filter', () => {
    const pack = clone(loadExample())
    pack.relationships[0].review_state = 'edited'
    expect(isTraversable(pack.relationships[0])).toBe(false)
    expect(isTraversable(pack.relationships[1])).toBe(true)
  })

  it('treats a published edge as traversable (published ⊇ reviewed)', () => {
    const pack = clone(loadExample())
    // Promote one reviewed edge to published; it must still be traversable.
    pack.relationships[0].review_state = 'published'
    const edges = traversableEdges(pack)
    expect(edges.some((e) => e.id === pack.relationships[0].id)).toBe(true)
    expect(isTraversable(pack.relationships[0])).toBe(true)
    // The other (reviewed) edge is still traversable too.
    expect(edges.length).toBe(pack.relationships.length)
  })

  it('does NOT make a non-reviewed edge a hard validation error', () => {
    const pack = clone(loadExample())
    pack.relationships[0].review_state = 'generated'
    const result = validatePack(pack)
    // unreviewed edges are allowed to exist; pack stays valid.
    expect(result.ok).toBe(true)
  })
})
