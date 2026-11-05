import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import type { AppEnv } from '../../app'
import { control } from '../../db'
import { requireApiKey } from '../../middleware/api-key'
import { emails } from './emails'

/** Public API, authenticated with project API keys. */
export const v1 = new Hono<AppEnv>()

v1.use('*', requireApiKey)

/** Identifies the calling key: useful to check SDK configuration. */
v1.get('/me', async (c) => {
  const key = c.get('apiKey')!
  const env = await c
    .get('db')
    .control.findFirst(control.environment, eq(control.environment.id, key.environmentId))
  return c.json({
    keyId: key.id,
    projectId: key.projectId,
    environment: { id: key.environmentId, name: env?.name, kind: env?.kind },
    scopes: key.scopes,
  })
})

v1.route('/emails', emails)
