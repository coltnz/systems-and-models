import { describe, it, expect } from 'vitest'
import { SCHEMA_VERSION } from '@sam/types'
import { validatePack } from '@sam/validator'
import { getAdapter } from '@sam/extraction'
import { createServer } from '@sam/server'

// Placeholder end-to-end test. bd-10 fills this with the real source -> reviewed
// -> tutor flow. For the scaffold it just proves every package wires together.
describe('@sam/e2e (scaffold placeholder)', () => {
  it('the workspace packages import and compose', () => {
    expect(SCHEMA_VERSION).toBe('0')
    // bd-4 replaced the validator stub with real structural + graph validation,
    // so an empty object now correctly fails (it is not a LearningPack). This
    // still proves @sam/validator is wired into the composed workspace.
    expect(validatePack({}).ok).toBe(false)
    const server = createServer({ adapter: getAdapter() })
    expect(server.adapter.name).toBe('mock')
  })
})
