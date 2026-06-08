import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve workspace deps to their TS source so tests run without a prior build.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@sam/types': r('../types/src/index.ts'),
      // Tests assemble + validate the extraction output via bd-5 ingest and
      // bd-4 validator (D-011 src alias pattern).
      '@sam/ingest': r('../ingest/src/index.ts'),
      '@sam/validator': r('../validator/src/index.ts'),
    },
  },
  test: {
    name: '@sam/extraction',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
