import { newId } from '@khata/dak-core'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { authSchema, control } from '../../db'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'

export const projects = new Hono<AppEnv>()

const REGION = z.string().regex(/^[a-z]{2}-[a-z]+-\d$/, 'Use an AWS region such as eu-west-1.')

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'project'
  )
}

projects.get('/', requirePermission({ project: ['read'] }), async (c) => {
  const db = c.get('db').control
  const workspaceId = c.req.query('workspaceId')
  const [rows, envs] = await Promise.all([
    db.findMany(
      control.project,
      and(
        isNull(control.project.archivedAt),
        workspaceId ? eq(control.project.workspaceId, workspaceId) : undefined,
      ),
      { orderBy: control.project.createdAt },
    ),
    db.findMany(control.environment, undefined, { orderBy: control.environment.createdAt }),
  ])
  return c.json({
    data: rows.map((p) => ({ ...p, environments: envs.filter((e) => e.projectId === p.id) })),
  })
})

const createProject = z.object({
  name: z.string().trim().min(1).max(80),
  workspaceId: z.string().min(1),
  infrastructureMode: z.enum(['platform', 'byo']).default('platform'),
  region: REGION.default('eu-west-1'),
})

projects.post(
  '/',
  requirePermission({ project: ['create'] }),
  validate('json', createProject),
  async (c) => {
    const body = c.req.valid('json')
    const db = c.get('db').control
    const team = await db.findFirst(authSchema.team, eq(authSchema.team.id, body.workspaceId))
    if (!team) throw new HttpError(422, 'invalid_workspace', 'Workspace not found.')

    const id = newId('project')
    let slug = slugify(body.name)
    if (await db.findFirst(control.project, eq(control.project.slug, slug))) {
      slug = `${slug}-${id.slice(-5).toLowerCase()}`
    }
    // Every project starts with a sandbox (test sink) and a production environment whose
    // sending stays disabled until the first-run checklist is complete.
    await db.db.batch([
      db.insert(control.project, {
        id,
        workspaceId: body.workspaceId,
        name: body.name,
        slug,
        infrastructureMode: body.infrastructureMode,
        region: body.region,
      }),
      db.insert(control.environment, [
        {
          id: newId('environment'),
          projectId: id,
          name: 'sandbox',
          kind: 'sandbox',
          sendingEnabled: true,
        },
        { id: newId('environment'), projectId: id, name: 'production', kind: 'production' },
      ]),
    ])
    await audit(c, { action: 'project.created', targetType: 'project', targetId: id, data: body })
    return c.json({ id, slug }, 201)
  },
)

async function loadProject(c: Context<AppEnv>, id: string) {
  const project = await c.get('db').control.findFirst(control.project, eq(control.project.id, id))
  if (!project || project.archivedAt) throw new HttpError(404, 'not_found', 'Project not found.')
  return project
}

const updateProject = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  retainBodies: z.boolean().optional(),
})

projects.patch(
  '/:id',
  requirePermission({ project: ['update'] }),
  validate('json', updateProject),
  async (c) => {
    const id = c.req.param('id')
    await loadProject(c, id)
    const body = c.req.valid('json')
    await c.get('db').control.update(control.project, body, eq(control.project.id, id))
    await audit(c, { action: 'project.updated', targetType: 'project', targetId: id, data: body })
    return c.json({ id })
  },
)

projects.delete('/:id', requirePermission({ project: ['delete'] }), async (c) => {
  const id = c.req.param('id')
  await loadProject(c, id)
  const db = c.get('db').control
  // Archive rather than delete: emails, usage and audit history keep their references.
  await db.db.batch([
    db.update(control.project, { archivedAt: Date.now() }, eq(control.project.id, id)),
    db.update(
      control.environment,
      { sendingEnabled: false, pausedAt: Date.now(), pauseReason: 'project_archived' },
      eq(control.environment.projectId, id),
    ),
  ])
  await audit(c, { action: 'project.archived', targetType: 'project', targetId: id })
  return c.body(null, 204)
})

const createEnvironment = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,32}$/, 'Lower-case letters, digits and dashes.'),
  kind: z.enum(['production', 'staging', 'sandbox']),
})

projects.post(
  '/:id/environments',
  requirePermission({ project: ['update'] }),
  validate('json', createEnvironment),
  async (c) => {
    const projectId = c.req.param('id')
    await loadProject(c, projectId)
    const body = c.req.valid('json')
    const db = c.get('db').control
    const clash = await db.findFirst(
      control.environment,
      and(eq(control.environment.projectId, projectId), eq(control.environment.name, body.name)),
    )
    if (clash) throw new HttpError(409, 'conflict', 'An environment with that name exists.')
    const id = newId('environment')
    await db.insert(control.environment, {
      id,
      projectId,
      name: body.name,
      kind: body.kind,
      sendingEnabled: body.kind === 'sandbox',
    })
    await audit(c, {
      action: 'environment.created',
      targetType: 'environment',
      targetId: id,
      data: body,
    })
    return c.json({ id }, 201)
  },
)

const updateEnvironment = z.object({
  sendingEnabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  pauseReason: z.string().max(200).optional(),
})

projects.patch(
  '/:id/environments/:envId',
  requirePermission({ infrastructure: ['manage'] }),
  validate('json', updateEnvironment),
  async (c) => {
    const { id: projectId, envId } = c.req.param()
    await loadProject(c, projectId)
    const body = c.req.valid('json')
    const db = c.get('db').control
    const env = await db.findFirst(
      control.environment,
      and(eq(control.environment.id, envId), eq(control.environment.projectId, projectId)),
    )
    if (!env) throw new HttpError(404, 'not_found', 'Environment not found.')

    const set: Partial<typeof control.environment.$inferInsert> = {}
    if (body.sendingEnabled !== undefined) set.sendingEnabled = body.sendingEnabled
    if (body.paused === true) {
      set.pausedAt = Date.now()
      set.pauseReason = body.pauseReason ?? 'manual'
    } else if (body.paused === false) {
      set.pausedAt = null
      set.pauseReason = null
    }
    await db.update(control.environment, set, eq(control.environment.id, envId))
    await audit(c, {
      action: body.paused ? 'environment.paused' : 'environment.updated',
      targetType: 'environment',
      targetId: envId,
      data: body,
    })
    return c.json({ id: envId })
  },
)
