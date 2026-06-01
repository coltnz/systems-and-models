// Root ESLint config. `npm run lint` runs `eslint .` from the repo root and
// lints every package via this flat config. Per-package eslint.config.js files
// exist so packages can be linted in isolation too; they extend the same base.
import { baseConfig } from './eslint.config.base.js'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // app/ is the reference spike (D-003); not part of the workspace lint gate.
      'app/**',
      'docs/**',
      'spec/**',
      'data/**',
      'ai/**',
    ],
  },
  ...baseConfig,
]
