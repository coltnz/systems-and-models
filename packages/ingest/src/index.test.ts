import { describe, it, expect } from 'vitest'
import { ingestSource } from './index.js'

describe('@sam/ingest (stub)', () => {
  it('throws not-implemented until bd-5 fills it in', () => {
    expect(() =>
      ingestSource({
        uri: 'https://example.com/x',
        media_type: 'text',
        title: 'x',
        license: 'open',
        access: 'open',
      }),
    ).toThrow(/not implemented/i)
  })
})
