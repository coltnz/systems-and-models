import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve workspace deps to their TS source so tests run without a prior build.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@sam/types': r('../types/src/index.ts'),
      // Tests validate the ingest output via bd-4 (D-011 src alias pattern).
      '@sam/validator': r('../validator/src/index.ts'),
    },
  },
  test: {
    name: '@sam/ingest',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
