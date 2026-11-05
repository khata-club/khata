import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { createAuth } from '../../auth'
import { authSchema, control } from '../../db'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'

/** Spec workspaces are Better Auth teams plus a `workspace_settings` row. */
export const workspaces = new Hono<AppEnv>()

workspaces.get('/', async (c) => {
  const db = c.get('db').control
  const [teams, settings] = await Promise.all([
    db.findMany(authSchema.team, undefined, { orderBy: authSchema.team.createdAt }),
    db.findMany(control.workspaceSettings),
  ])
  const byId = new Map(settings.map((s) => [s.workspaceId, s]))
  return c.json({
    data: teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: t.memberCount,
      createdAt: t.createdAt,
      defaultRegion: byId.get(t.id)?.defaultRegion ?? null,
    })),
  })
})

const createWorkspace = z.object({
  name: z.string().trim().min(1).max(80),
  defaultRegion: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d$/)
    .optional(),
})

workspaces.post(
  '/',
  requirePermission({ workspace: ['create'] }),
  validate('json', createWorkspace),
  async (c) => {
    const body = c.req.valid('json')
    const m = c.get('member')!
    const team = await createAuth(c.env).api.createTeam({
      body: { name: body.name, organizationId: m.tenant.organizationId },
      headers: c.req.raw.headers,
    })
    await c.get('db').control.insert(control.workspaceSettings, {
      workspaceId: team.id,
      defaultRegion: body.defaultRegion ?? null,
    })
    await audit(c, { action: 'workspace.created', targetType: 'workspace', targetId: team.id })
    return c.json({ id: team.id, name: team.name }, 201)
  },
)

const updateWorkspace = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  defaultRegion: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d$/)
    .nullable()
    .optional(),
})

workspaces.patch(
  '/:id',
  requirePermission({ workspace: ['update'] }),
  validate('json', updateWorkspace),
  async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const db = c.get('db').control
    const team = await db.findFirst(authSchema.team, eq(authSchema.team.id, id))
    if (!team) throw new HttpError(404, 'not_found', 'Workspace not found.')

    if (body.name) await db.update(authSchema.team, { name: body.name }, eq(authSchema.team.id, id))
    if (body.defaultRegion !== undefined) {
      await db.db
        .insert(control.workspaceSettings)
        .values({
          workspaceId: id,
          organizationId: db.tenant.organizationId,
          defaultRegion: body.defaultRegion,
        })
        .onConflictDoUpdate({
          target: control.workspaceSettings.workspaceId,
          set: { defaultRegion: body.defaultRegion, updatedAt: Date.now() },
          setWhere: and(eq(control.workspaceSettings.organizationId, db.tenant.organizationId)),
        })
    }
    await audit(c, {
      action: 'workspace.updated',
      targetType: 'workspace',
      targetId: id,
      data: body,
    })
    return c.json({ id })
  },
)
