import { fileURLToPath, URL } from 'node:url'

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Tests run inside workerd with a fresh Miniflare D1 per test file.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url)))
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
            GOOGLE_CLIENT_ID: 'test-client',
            GOOGLE_CLIENT_SECRET: 'test-secret',
          },
        },
      }),
    ],
    resolve: {
      alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
    },
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
