import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { Hono } from 'hono'

import type { AppEnv } from '../../app'
import { control } from '../../db'
import { requireScope } from '../../middleware/api-key'

export const templatesV1 = new Hono<AppEnv>()

/** Published templates the key's project can send, with their variable schemas. */
templatesV1.get('/', requireScope('templates:read'), async (c) => {
  const key = c.get('apiKey')!
  const db = c.get('db').control
  const rows = await db.findMany(
    control.template,
    and(
      eq(control.template.projectId, key.projectId),
      isNull(control.template.archivedAt),
      isNotNull(control.template.publishedVersionId),
    ),
  )
  const versions = await db.findMany(
    control.templateVersion,
    eq(control.templateVersion.status, 'published'),
  )
  return c.json({
    data: rows.map((t) => {
      const v = versions.find((x) => x.id === t.publishedVersionId)!
      return { id: t.id, alias: t.alias, name: t.name, version: v.version, variables: v.variables }
    }),
  })
})
