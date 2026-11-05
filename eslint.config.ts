import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  globalIgnores([
    '**/dist/**',
    '**/storybook-static/**',
    '**/coverage/**',
    '**/cdk.out/**',
    '**/.wrangler/**',
    '**/worker-configuration.d.ts',
  ]),
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    // Dak tenancy guard: D1 bindings and Drizzle clients are only reachable through
    // apps/dak-api/src/db, whose `scoped()` makes the organization filter mandatory.
    files: ['apps/dak-api/src/**/*.ts'],
    ignores: ['apps/dak-api/src/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'drizzle-orm/d1', message: 'Use databases() from src/db.' }] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^DB(_EVENTS)?$/]',
          message: 'Access D1 through databases() and scoped() from src/db.',
        },
      ],
    },
  },
)
