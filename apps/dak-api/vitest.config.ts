import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Tests run inside workerd via Miniflare with local D1, R2, Queues and Durable Objects
// built from wrangler.jsonc; each test file gets isolated storage with migrations applied.
export default defineConfig(async () => {
  const [control, events] = await Promise.all([
    readD1Migrations('./migrations/control'),
    readD1Migrations('./migrations/events'),
  ])
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_CONTROL_MIGRATIONS: control,
            TEST_EVENTS_MIGRATIONS: events,
            BETTER_AUTH_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
            DAK_DATA_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
          },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  }
})
