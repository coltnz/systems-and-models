// Shared flat ESLint config for all @sam/* packages.
// Each package's eslint.config.js imports this and may append package-specific
// config (e.g. web adds react-hooks / react-refresh). See D-004.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Base flat config: js.recommended + typescript-eslint recommended.
 * Exported as an array so packages can spread it into their own config.
 * @type {import('typescript-eslint').ConfigArray}
 */
export const baseConfig = tseslint.config(
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
)

export default baseConfig
