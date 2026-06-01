import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve workspace deps to their TS source so tests run without a prior build.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@sam/types': r('../types/src/index.ts'),
    },
  },
  test: {
    name: '@sam/extraction',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
