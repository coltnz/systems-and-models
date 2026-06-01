import { describe, it, expect } from 'vitest'
import { validatePack } from './index.js'

describe('@sam/validator (stub)', () => {
  it('accepts any input for now (bd-4 implements real validation)', () => {
    const result = validatePack({ anything: true })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})
