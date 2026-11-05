import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Runs before each test file; migrations are idempotent and storage is isolated per file.
await applyD1Migrations(env.DB, env.TEST_CONTROL_MIGRATIONS)
await applyD1Migrations(env.DB_EVENTS, env.TEST_EVENTS_MIGRATIONS)
