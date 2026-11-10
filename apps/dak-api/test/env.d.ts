import type { D1Migration } from '@cloudflare/vitest-plugin'

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_CONTROL_MIGRATIONS: D1Migration[]
      TEST_EVENTS_MIGRATIONS: D1Migration[]
    }
  }
}
