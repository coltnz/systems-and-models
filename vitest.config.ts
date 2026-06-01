import { defineConfig } from 'vitest/config'

// Root Vitest config. `npm test` -> `vitest run` from the repo root discovers
// each workspace package via `projects` (D-004). Most packages run in the node
// environment; @sam/web supplies its own jsdom config. New packages are picked
// up automatically by the packages/* glob as long as they have a vitest config
// or test files matching the default include.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
