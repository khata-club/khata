import {
  BlockDocument,
  checkTemplate,
  findStarter,
  renderBlocks,
  STARTERS,
  maskSensitive,
  newId,
  renderTemplate,
  sampleVariables,
  TemplateError,
  TemplateVariables,
  type TemplateVariable,
} from '@khata/dak-core'
import { and, desc, eq, isNull, max } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { control } from '../../db'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { acceptEmail } from '../../sending/accept'
import { audit } from '../../services/audit'

/** Mounted at /api/projects/:projectId/templates. */
export const templates = new Hono<AppEnv>()

const STARTER_HTML = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937">
    <p>Hello {{ name }},</p>
    <p>Write your message here.</p>
  </body>
</html>`

type Version = typeof control.templateVersion.$inferSelect

async function project(c: Context<AppEnv>) {
  const p = await c
    .get('db')
    .control.findFirst(control.project, eq(control.project.id, c.req.param('projectId')!))
  if (!p || p.archivedAt) throw new HttpError(404, 'not_found', 'Project not found.')
  return p
}

async function template(c: Context<AppEnv>) {
  const p = await project(c)
  const t = await c
    .get('db')
    .control.findFirst(
      control.template,
      and(
        eq(control.template.id, c.req.param('templateId')!),
        eq(control.template.projectId, p.id),
      ),
    )
  if (!t) throw new HttpError(404, 'not_found', 'Template not found.')
  return { project: p, template: t }
}

async function versions(c: Context<AppEnv>, templateId: string) {
  return c
    .get('db')
    .control.findMany(control.templateVersion, eq(control.templateVersion.templateId, templateId), {
      orderBy: desc(control.templateVersion.version),
    })
}

templates.get('/', requirePermission({ template: ['read'] }), async (c) => {
  const p = await project(c)
  const db = c.get('db').control
  const rows = await db.findMany(
    control.template,
    and(eq(control.template.projectId, p.id), isNull(control.template.archivedAt)),
    { orderBy: control.template.name },
  )
  const all = await db.findMany(control.templateVersion, undefined)
  return c.json({
    data: rows.map((t) => {
      const vs = all.filter((v) => v.templateId === t.id)
      const published = vs.find((v) => v.id === t.publishedVersionId)
      return {
        ...t,
        publishedVersion: published?.version ?? null,
        hasDraft: vs.some((v) => v.status === 'draft'),
        updatedAt: Math.max(...vs.map((v) => v.createdAt), t.createdAt),
      }
    }),
  })
})

const createTemplate = z.object({
  alias: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'Lower-case letters, digits and dashes.'),
  name: z.string().trim().min(1).max(120),
  editor: z.enum(['code', 'visual']).default('code'),
  subject: z.string().max(998).optional(),
  html: z
    .string()
    .max(512 * 1024)
    .optional(),
  variables: TemplateVariables.optional(),
  blocks: z.unknown().optional(),
  /** Start from a starter template (visual). */
  starter: z.string().optional(),
})

/** Visual documents are authoritative: the stored HTML is always their rendering. */
function fromBlocks(blocks: unknown): { html: string; blocks: unknown } | undefined {
  if (blocks === undefined || blocks === null) return undefined
  const parsed = BlockDocument.safeParse(blocks)
  if (!parsed.success) {
    throw new HttpError(422, 'invalid_blocks', 'The visual document is invalid.', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  return { html: renderBlocks(parsed.data), blocks: parsed.data }
}

templates.get('/starters', requirePermission({ template: ['read'] }), (c) =>
  c.json({
    data: STARTERS.map(({ id, name, description, stream }) => ({ id, name, description, stream })),
  }),
)

templates.post(
  '/',
  requirePermission({ template: ['write'] }),
  validate('json', createTemplate),
  async (c) => {
    const p = await project(c)
    const body = c.req.valid('json')
    const db = c.get('db').control
    if (
      await db.findFirst(
        control.template,
        and(eq(control.template.projectId, p.id), eq(control.template.alias, body.alias)),
      )
    ) {
      throw new HttpError(409, 'conflict', 'A template with this alias exists.')
    }
    const starter = body.starter ? findStarter(body.starter) : undefined
    if (body.starter && !starter)
      throw new HttpError(422, 'unknown_starter', 'No starter with that ID.')
    const visual = fromBlocks(starter?.document ?? body.blocks)
    const id = newId('template')
    await db.db.batch([
      db.insert(control.template, {
        id,
        projectId: p.id,
        alias: body.alias,
        name: body.name,
        editor: visual || body.editor === 'visual' ? 'visual' : 'code',
      }),
      db.insert(control.templateVersion, {
        id: newId('templateVersion'),
        templateId: id,
        version: 1,
        status: 'draft',
        subject: starter?.subject ?? body.subject ?? 'Hello {{ name }}',
        html: visual?.html ?? body.html ?? STARTER_HTML,
        variables: TemplateVariables.parse(
          starter?.variables ??
            body.variables ?? [{ name: 'name', required: true, example: 'Ada' }],
        ),
        blocks: visual?.blocks ?? null,
        createdBy: c.get('member')!.user.id,
      }),
    ])
    await audit(c, {
      action: 'template.created',
      targetType: 'template',
      targetId: id,
      data: { alias: body.alias },
    })
    return c.json({ id }, 201)
  },
)

templates.get('/:templateId', requirePermission({ template: ['read'] }), async (c) => {
  const { template: t } = await template(c)
  return c.json({ ...t, versions: await versions(c, t.id) })
})

const draftBody = z.object({
  subject: z.string().max(998),
  html: z.string().max(512 * 1024),
  text: z
    .string()
    .max(512 * 1024)
    .nullable()
    .optional(),
  variables: TemplateVariables,
  blocks: z.unknown().optional(),
})

/** Saves the working draft, creating it from the latest version when none exists. */
templates.put(
  '/:templateId/draft',
  requirePermission({ template: ['write'] }),
  validate('json', draftBody),
  async (c) => {
    const { template: t } = await template(c)
    const raw = c.req.valid('json')
    const visual = fromBlocks(raw.blocks)
    if (!visual && raw.blocks === null && t.editor === 'visual') {
      // One-way conversion to HTML (spec §6): the template is code-edited from now on.
      await c
        .get('db')
        .control.update(control.template, { editor: 'code' }, eq(control.template.id, t.id))
    }
    const body = { ...raw, html: visual?.html ?? raw.html }
    const db = c.get('db').control
    const vs = await versions(c, t.id)
    const draft = vs.find((v) => v.status === 'draft')
    const values = {
      subject: body.subject,
      html: body.html,
      text: body.text ?? null,
      variables: body.variables,
      blocks: visual?.blocks ?? null,
    }
    if (draft) {
      await db.update(control.templateVersion, values, eq(control.templateVersion.id, draft.id))
      return c.json({
        id: draft.id,
        version: draft.version,
        checks: checkTemplate(body, body.variables),
      })
    }
    const [row] = await db.db
      .select({ n: max(control.templateVersion.version) })
      .from(control.templateVersion)
      .where(db.where(control.templateVersion, eq(control.templateVersion.templateId, t.id)))
    const n = row?.n ?? 0
    const id = newId('templateVersion')
    await db.insert(control.templateVersion, {
      id,
      templateId: t.id,
      version: n + 1,
      status: 'draft',
      ...values,
      createdBy: c.get('member')!.user.id,
    })
    return c.json({ id, version: n + 1, checks: checkTemplate(body, body.variables) }, 201)
  },
)

/** Publishing freezes the draft: published versions are immutable (spec §6). */
templates.post('/:templateId/publish', requirePermission({ template: ['publish'] }), async (c) => {
  const { template: t } = await template(c)
  const draft = (await versions(c, t.id)).find((v) => v.status === 'draft')
  if (!draft) throw new HttpError(409, 'no_draft', 'There is no draft to publish.')
  const errors = checkTemplate(draft, draft.variables as TemplateVariable[]).filter(
    (x) => x.level === 'error',
  )
  if (errors.length)
    throw new HttpError(422, 'template_invalid', 'Fix the errors before publishing.', {
      checks: errors,
    })
  const db = c.get('db').control
  await db.db.batch([
    db.update(
      control.templateVersion,
      { status: 'published', publishedAt: Date.now() },
      and(eq(control.templateVersion.id, draft.id), eq(control.templateVersion.status, 'draft')),
    ),
    db.update(control.template, { publishedVersionId: draft.id }, eq(control.template.id, t.id)),
  ])
  await audit(c, {
    action: 'template.published',
    targetType: 'template',
    targetId: t.id,
    data: { version: draft.version },
  })
  return c.json({ id: draft.id, version: draft.version })
})

templates.post(
  '/:templateId/rollback',
  requirePermission({ template: ['publish'] }),
  validate('json', z.object({ versionId: z.string() })),
  async (c) => {
    const { template: t } = await template(c)
    const target = (await versions(c, t.id)).find((v) => v.id === c.req.valid('json').versionId)
    if (!target || target.status !== 'published') {
      throw new HttpError(422, 'invalid_version', 'Only a published version can become current.')
    }
    await c
      .get('db')
      .control.update(
        control.template,
        { publishedVersionId: target.id },
        eq(control.template.id, t.id),
      )
    await audit(c, {
      action: 'template.rolled_back',
      targetType: 'template',
      targetId: t.id,
      data: { version: target.version },
    })
    return c.json({ id: target.id, version: target.version })
  },
)

templates.post('/:templateId/archive', requirePermission({ template: ['write'] }), async (c) => {
  const { template: t } = await template(c)
  await c
    .get('db')
    .control.update(control.template, { archivedAt: Date.now() }, eq(control.template.id, t.id))
  await audit(c, { action: 'template.archived', targetType: 'template', targetId: t.id })
  return c.body(null, 204)
})

const previewBody = z.object({
  versionId: z.string().optional(),
  source: draftBody.optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
})

/** Renders without storing anything; sensitive variables are masked in the response. */
templates.post(
  '/:templateId/preview',
  requirePermission({ template: ['read'] }),
  validate('json', previewBody),
  async (c) => {
    const { template: t } = await template(c)
    const body = c.req.valid('json')
    let source: Pick<Version, 'subject' | 'html' | 'text'> & { variables: TemplateVariable[] }
    if (body.source) {
      const visual = fromBlocks(body.source.blocks)
      source = {
        ...body.source,
        html: visual?.html ?? body.source.html,
        text: body.source.text ?? null,
      }
    } else {
      const vs = await versions(c, t.id)
      const v = vs.find((x) => x.id === (body.versionId ?? t.publishedVersionId)) ?? vs[0]
      if (!v) throw new HttpError(404, 'not_found', 'Version not found.')
      source = { ...v, variables: v.variables as TemplateVariable[] }
    }
    const vars = maskSensitive(
      source.variables,
      body.variables ?? sampleVariables(source.variables),
    )
    const checks = checkTemplate(source, source.variables)
    try {
      return c.json({ ...renderTemplate(source, source.variables, vars), checks })
    } catch (err) {
      if (err instanceof TemplateError)
        return c.json(
          {
            error: {
              code: 'template_invalid',
              message: err.message,
              details: { issues: err.issues },
            },
            checks,
          },
          422,
        )
      throw err
    }
  },
)

/** Sends the draft (or a version) to a test address through the chosen environment. */
templates.post(
  '/:templateId/test',
  requirePermission({ template: ['read'], email: ['send'] }),
  validate(
    'json',
    z.object({
      to: z.email(),
      from: z.string().min(3),
      environmentId: z.string(),
      versionId: z.string().optional(),
      variables: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  async (c) => {
    const { project: p, template: t } = await template(c)
    const body = c.req.valid('json')
    const vs = await versions(c, t.id)
    const v =
      vs.find((x) => x.id === body.versionId) ?? vs.find((x) => x.status === 'draft') ?? vs[0]
    if (!v) throw new HttpError(404, 'not_found', 'Version not found.')
    const schema = v.variables as TemplateVariable[]
    let rendered
    try {
      rendered = renderTemplate(v, schema, body.variables ?? sampleVariables(schema))
    } catch (err) {
      if (err instanceof TemplateError)
        throw new HttpError(422, 'template_invalid', err.message, { issues: err.issues })
      throw err
    }
    const { response } = await acceptEmail(
      {
        env: c.env,
        db: c.get('db'),
        key: {
          id: `member:${c.get('member')!.user.id}`,
          projectId: p.id,
          environmentId: body.environmentId,
          allowedDomains: [],
        },
        waitUntil: (pr) => c.executionCtx.waitUntil(pr),
      },
      {
        from: body.from,
        to: body.to,
        subject: `[Test] ${rendered.subject}`,
        html: rendered.html,
        text: rendered.text,
        stream: 'transactional',
        tags: { dak_test: 'true', template: t.alias },
      },
    )
    await audit(c, {
      action: 'template.test_sent',
      targetType: 'template',
      targetId: t.id,
      data: { to: body.to, version: v.version },
    })
    return c.json(response, 202)
  },
)
