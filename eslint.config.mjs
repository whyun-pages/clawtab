import js from '@eslint/js'
import globals from 'globals'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
/**
 * @type {Partial<RulesConfig>}
 */
const customRules = {
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/explicit-member-accessibility': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  // semi: ['error', 'never'],
  curly: ['error', 'all'],
  'no-console': 'error',

}

export default defineConfig([
  {
    ignores: ['dist/', 'coverage/', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: customRules,
  },
])
