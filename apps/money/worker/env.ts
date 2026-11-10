import type { D1Migration } from '@cloudflare/vitest-plugin'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ENVIRONMENT: 'dev' | 'production'
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  /** Only bound in tests. */
  TEST_MIGRATIONS?: D1Migration[]
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends AppBindings {}
  }
}
type AppBindings = Env
