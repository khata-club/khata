import type { ApiScope } from '@khata/dak-core'
import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../app'
import { control, databases, scoped } from '../db'
import { sha256Hex } from '../lib/crypto'
import { HttpError } from '../lib/errors'

const TOUCH_EVERY_MS = 5 * 60_000

/**
 * Bearer API-key auth for the public API. The key is looked up by its SHA-256 (the only
 * tenant-crossing read, by design), then every later query is scoped to its organization.
 */
export const requireApiKey = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? ''
  const token = /^Bearer\s+(dak_(?:live|test)_[A-Za-z0-9_-]{20,})$/.exec(header)?.[1]
  if (!token) throw new HttpError(401, 'missing_api_key', 'Send `Authorization: Bearer dak_…`.')

  const dbs = databases(c.env)
  const [key] = await dbs.control
    .select()
    .from(control.apiKey)
    .where(eq(control.apiKey.hash, await sha256Hex(token)))
    .limit(1)
  const now = Date.now()
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < now)) {
    throw new HttpError(401, 'invalid_api_key', 'This API key is invalid, revoked or expired.')
  }

  const tenant = { organizationId: key.organizationId }
  c.set('apiKey', {
    id: key.id,
    projectId: key.projectId,
    environmentId: key.environmentId,
    scopes: key.scopes,
    allowedDomains: key.allowedDomains,
  })
  c.set('db', { control: scoped(dbs.control, tenant), events: scoped(dbs.events, tenant) })

  if (!key.lastUsedAt || now - key.lastUsedAt > TOUCH_EVERY_MS) {
    c.executionCtx.waitUntil(
      dbs.control
        .update(control.apiKey)
        .set({ lastUsedAt: now })
        .where(eq(control.apiKey.id, key.id))
        .then(() => {}),
    )
  }
  await next()
})

export function requireScope(scope: ApiScope) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!c.get('apiKey')?.scopes.includes(scope)) {
      throw new HttpError(403, 'insufficient_scope', `This key lacks the \`${scope}\` scope.`)
    }
    await next()
  })
}
