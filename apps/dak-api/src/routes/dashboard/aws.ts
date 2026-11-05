import { newId } from '@khata/dak-core'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { clearCredentialCache, connectionCredentials } from '../../aws/credentials'
import { checkHealth } from '../../aws/health'
import { AwsError } from '../../aws/ses'
import { control, events } from '../../db'
import { randomToken, seal } from '../../lib/crypto'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'

export const aws = new Hono<AppEnv>()

const REGION = z.string().regex(/^[a-z]{2}-[a-z]+-\d$/)
const ROLE_ARN = z
  .string()
  .regex(
    /^arn:aws[a-z-]*:iam::\d{12}:role\/DakSending-[0-9A-Z]{26}$/,
    'Paste the RoleArn output of the Dak stack.',
  )

type Connection = typeof control.awsConnection.$inferSelect

function present(c: Connection) {
  const { externalIdEnc: _secret, ...rest } = c
  void _secret
  return rest
}

function launchUrl(env: Env, conn: Connection, externalId: string) {
  const q = new URLSearchParams({
    templateURL: env.DAK_BYO_TEMPLATE_URL,
    stackName: `dak-sending-${conn.id.slice(4, 12).toLowerCase()}`,
    param_ExternalId: externalId,
    param_ConnectionId: conn.id,
  })
  return `https://${conn.region}.console.aws.amazon.com/cloudformation/home?region=${conn.region}#/stacks/quickcreate?${q}`
}

async function load(c: Context<AppEnv>, id: string): Promise<Connection> {
  const conn = await c
    .get('db')
    .control.findFirst(control.awsConnection, eq(control.awsConnection.id, id))
  if (!conn) throw new HttpError(404, 'not_found', 'AWS connection not found.')
  return conn
}

aws.get('/', requirePermission({ infrastructure: ['read'] }), async (c) => {
  const rows = await c
    .get('db')
    .control.findMany(control.awsConnection, undefined, { orderBy: desc(control.awsConnection.id) })
  return c.json({ data: rows.map(present) })
})

/**
 * Step 1: create a pending BYO connection. The ExternalId is shown once here (and is part of
 * the launch URL); afterwards only its sealed form is stored.
 */
aws.post(
  '/',
  requirePermission({ infrastructure: ['manage'] }),
  validate('json', z.object({ region: REGION })),
  async (c) => {
    const { region } = c.req.valid('json')
    const id = newId('awsConnection')
    const externalId = randomToken(24)
    const row = {
      id,
      mode: 'byo' as const,
      region,
      status: 'pending' as const,
      externalIdEnc: await seal(c.env.DAK_DATA_KEY, externalId),
      configurationSetPrefix: `dak-${id.slice(4)}`,
    }
    await c.get('db').control.insert(control.awsConnection, row)
    await audit(c, {
      action: 'aws_connection.created',
      targetType: 'aws_connection',
      targetId: id,
      data: { region },
    })
    const conn = (await load(c, id))!
    return c.json(
      { ...present(conn), externalId, launchUrl: launchUrl(c.env, conn, externalId) },
      201,
    )
  },
)

/** Step 2: record the role ARN from the stack outputs and verify it end to end. */
aws.post(
  '/:id/verify',
  requirePermission({ infrastructure: ['manage'] }),
  validate('json', z.object({ roleArn: ROLE_ARN })),
  async (c) => {
    const conn = await load(c, c.req.param('id'))
    if (conn.mode !== 'byo')
      throw new HttpError(409, 'not_byo', 'Only BYO connections take a role.')
    if (conn.status === 'disconnected')
      throw new HttpError(409, 'disconnected', 'This connection was disconnected.')
    const { roleArn } = c.req.valid('json')
    if (!roleArn.endsWith(conn.id.slice(4))) {
      throw new HttpError(422, 'role_mismatch', 'That role belongs to a different Dak connection.')
    }
    clearCredentialCache(conn.id)
    const health = await runHealth(c, { ...conn, roleArn })
    await audit(c, {
      action: 'aws_connection.verified',
      targetType: 'aws_connection',
      targetId: conn.id,
      data: { roleArn, ok: health.ok },
    })
    return c.json({ ...present((await load(c, conn.id))!), health })
  },
)

aws.post('/:id/check', requirePermission({ infrastructure: ['read'] }), async (c) => {
  const conn = await load(c, c.req.param('id'))
  const health = await runHealth(c, conn)
  return c.json({ ...present((await load(c, conn.id))!), health })
})

async function runHealth(c: Context<AppEnv>, conn: Connection) {
  let health
  let accountId = conn.accountId ?? undefined
  try {
    const creds = await connectionCredentials(c.env, conn)
    if ('accountId' in creds && typeof creds.accountId === 'string') accountId = creds.accountId
    health = await checkHealth(creds, {
      configurationSetPrefix: conn.configurationSetPrefix,
      accountId,
    })
  } catch (err) {
    const detail =
      err instanceof AwsError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err)
    health = {
      ok: false,
      checkedAt: Date.now(),
      region: conn.region,
      checks: [{ id: 'assume', label: 'Dak can assume the role', ok: false, detail }],
    }
  }
  await c.get('db').control.update(
    control.awsConnection,
    {
      roleArn: conn.roleArn,
      accountId: accountId ?? null,
      status: health.ok ? 'healthy' : conn.status === 'pending' ? 'pending' : 'degraded',
      health: health as unknown as Record<string, unknown>,
      checkedAt: health.checkedAt,
    },
    eq(control.awsConnection.id, conn.id),
  )
  return health
}

/**
 * Disconnect (spec §3): stop new sends now, let accepted work drain, then revoke. Mail already
 * handed to SES cannot be recalled; the dashboard says so before confirming.
 */
aws.post('/:id/disconnect', requirePermission({ infrastructure: ['manage'] }), async (c) => {
  const conn = await load(c, c.req.param('id'))
  const db = c.get('db')
  const linked = await db.control.findMany(
    control.project,
    eq(control.project.awsConnectionId, conn.id),
  )
  const projectIds = linked.map((p) => p.id)

  if (projectIds.length) {
    await db.control.update(
      control.environment,
      { sendingEnabled: false, pausedAt: Date.now(), pauseReason: 'aws_disconnected' },
      inArray(control.environment.projectId, projectIds),
    )
  }
  const inFlight = projectIds.length
    ? await db.events.findFirst(
        events.email,
        and(
          inArray(events.email.projectId, projectIds),
          inArray(events.email.status, ['accepted', 'scheduled', 'queued', 'sending']),
        ),
      )
    : undefined

  const status = inFlight ? 'disconnecting' : 'disconnected'
  await db.control.update(
    control.awsConnection,
    {
      status,
      ...(status === 'disconnected' && { disconnectedAt: Date.now(), externalIdEnc: null }),
    },
    eq(control.awsConnection.id, conn.id),
  )
  clearCredentialCache(conn.id)
  await audit(c, {
    action: 'aws_connection.disconnected',
    targetType: 'aws_connection',
    targetId: conn.id,
    data: { status, projects: projectIds },
  })
  return c.json({ id: conn.id, status, pausedProjects: projectIds })
})

/** Attach a healthy BYO connection to a project in the same region. No silent mode changes. */
aws.post(
  '/:id/attach',
  requirePermission({ infrastructure: ['manage'] }),
  validate('json', z.object({ projectId: z.string() })),
  async (c) => {
    const conn = await load(c, c.req.param('id'))
    const { projectId } = c.req.valid('json')
    const db = c.get('db').control
    const project = await db.findFirst(control.project, eq(control.project.id, projectId))
    if (!project) throw new HttpError(404, 'not_found', 'Project not found.')
    if (project.infrastructureMode !== 'byo') {
      throw new HttpError(409, 'mode_mismatch', 'This project sends through Dak-managed AWS.')
    }
    if (conn.status !== 'healthy')
      throw new HttpError(409, 'unhealthy', 'Verify the connection first.')
    if (conn.region !== project.region) {
      throw new HttpError(
        409,
        'region_mismatch',
        `Connection is in ${conn.region}; project is in ${project.region}.`,
      )
    }
    await db.update(
      control.project,
      { awsConnectionId: conn.id },
      eq(control.project.id, projectId),
    )
    await audit(c, {
      action: 'project.aws_attached',
      targetType: 'project',
      targetId: projectId,
      data: { connection: conn.id },
    })
    return c.json({ projectId, awsConnectionId: conn.id })
  },
)
