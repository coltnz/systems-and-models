import { describe, it, expect } from 'vitest'
import { getAdapter, MockExtractionAdapter } from './index.js'

describe('@sam/extraction (stub)', () => {
  it('getAdapter returns the mock by default', () => {
    const adapter = getAdapter()
    expect(adapter).toBeInstanceOf(MockExtractionAdapter)
    expect(adapter.name).toBe('mock')
  })

  it('mock extraction is empty and zero-cost', async () => {
    const result = await new MockExtractionAdapter().extract({
      source_asset_id: 'src-1',
      text: 'hello',
    })
    expect(result.atoms).toEqual([])
    expect(result.anchors).toEqual([])
    expect(result.cost.usd).toBe(0)
  })

  it('fails loud when an unimplemented openai adapter is requested', () => {
    expect(() => getAdapter({ EXTRACTION_ADAPTER: 'openai' })).toThrow(/bd-6/)
  })
})
