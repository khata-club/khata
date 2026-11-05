import { newId } from '@khata/dak-core'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { control, databases, events, scoped } from '../src/db'

const db = databases(env)
const orgA = scoped(db.control, { organizationId: 'org_A' })
const orgB = scoped(db.control, { organizationId: 'org_B' })

async function seedProject(s: typeof orgA, slug: string) {
  const id = newId('project')
  await s.insert(control.project, {
    id,
    workspaceId: 'ws_1',
    name: slug,
    slug,
    infrastructureMode: 'platform',
    region: 'eu-west-1',
  })
  return id
}

describe('scoped data access', () => {
  it('applies both migration sets', async () => {
    const tables = async (d: D1Database) =>
      (await d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results.map(
        (r) => r.name,
      )
    expect(await tables(env.DB)).toEqual(expect.arrayContaining(['project', 'api_key', 'domain']))
    expect(await tables(env.DB_EVENTS)).toEqual(
      expect.arrayContaining(['email', 'email_recipient', 'outbox', 'usage_entry']),
    )
  })

  it('stamps inserts with the tenant and isolates reads', async () => {
    const a = await seedProject(orgA, 'shop')
    await seedProject(orgB, 'shop')

    const mine = await orgA.findMany(control.project)
    expect(mine.map((p) => p.id)).toEqual([a])
    expect(mine[0]!.organizationId).toBe('org_A')
    expect(await orgB.findFirst(control.project, eq(control.project.id, a))).toBeUndefined()
  })

  it('cannot update or delete another tenant’s rows', async () => {
    const a = await seedProject(orgA, 'mail')
    await orgB.update(control.project, { name: 'hijacked' }, eq(control.project.id, a))
    await orgB.delete(control.project, eq(control.project.id, a))
    expect((await orgA.findFirst(control.project, eq(control.project.id, a)))?.name).toBe('mail')
  })

  it('ignores attempts to move a row to another tenant', async () => {
    const a = await seedProject(orgA, 'move')
    await orgA.update(control.project, { organizationId: 'org_B', name: 'moved' } as never)
    const row = await orgA.findFirst(control.project, eq(control.project.id, a))
    expect(row).toMatchObject({ organizationId: 'org_A', name: 'moved' })
  })

  it('requires an organization', () => {
    expect(() => scoped(db.control, { organizationId: '' })).toThrow()
  })

  it('scopes the events database too', async () => {
    const ev = scoped(db.events, { organizationId: 'org_A' })
    const id = newId('email')
    await ev.insert(events.email, {
      id,
      projectId: 'prj_1',
      environmentId: 'env_1',
      stream: 'transactional',
      status: 'accepted',
      fromAddress: 'a@acme.dev',
      subject: 'Hi',
      acceptedAt: Date.now(),
    })
    expect(await scoped(db.events, { organizationId: 'org_B' }).findMany(events.email)).toEqual([])
    expect((await ev.findMany(events.email))[0]?.tags).toEqual({})
  })
})
