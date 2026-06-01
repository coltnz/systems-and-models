import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Resolve workspace deps to their TS source so tests run without a prior build.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        '@sam/types': r('../types/src/index.ts'),
      },
    },
    test: {
      name: '@sam/web',
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
)
