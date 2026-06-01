import { describe, it, expect } from 'vitest'
import { createServer } from './index.js'

describe('@sam/server (stub)', () => {
  it('builds a server object without binding a port', () => {
    const server = createServer()
    expect(server.dataDir).toBe('.systems-and-models')
    expect(server.adapter.name).toBe('mock')
  })

  it('does not start listening yet (bd-7)', async () => {
    const server = createServer()
    await expect(server.listen(0)).rejects.toThrow(/not implemented/i)
  })
})
