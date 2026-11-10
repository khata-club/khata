import { asc, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { todayIST } from '../../shared/dates'
import { monthlyNeeded } from '../../shared/plan'
import { goalContributionInput, goalInput } from '../../shared/schemas'
import type { Goal } from '../../shared/types'
import { goalContributions, goals } from '../db/schema'
import { notFound, validate } from '../lib/http'
import { own } from '../lib/owned'
import type { AppEnv } from '../types'

type Row = typeof goals.$inferSelect
const toDto = (g: Row): Goal => ({
  id: g.id,
  name: g.name,
  target: g.target,
  targetDate: g.targetDate,
  icon: g.icon,
  saved: g.saved,
  archived: g.archived,
  monthlyNeeded: monthlyNeeded(g.target, g.saved, g.targetDate, todayIST()),
})

export const goalRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, userId } = c.var
    const rows = await db
      .select()
      .from(goals)
      .where(own(goals, userId))
      .orderBy(asc(goals.archived), asc(goals.targetDate), asc(goals.createdAt))
    return c.json(rows.map(toDto))
  })
  .post('/', validate('json', goalInput), async (c) => {
    const { db, userId } = c.var
    const body = c.req.valid('json')
    const [row] = await db
      .insert(goals)
      .values({
        ...body,
        targetDate: body.targetDate ?? null,
        archived: body.archived ?? false,
        id: ulid(),
        userId,
      })
      .returning()
    return c.json(toDto(row!), 201)
  })
  .patch('/:id', validate('json', goalInput.partial()), async (c) => {
    const { db, userId } = c.var
    const [row] = await db
      .update(goals)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(own(goals, userId, eq(goals.id, c.req.param('id'))))
      .returning()
    if (!row) throw notFound()
    return c.json(toDto(row))
  })
  .delete('/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(goals)
      .where(own(goals, userId, eq(goals.id, c.req.param('id'))))
      .returning({ id: goals.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
  .get('/:id/contributions', async (c) => {
    const { db, userId } = c.var
    const rows = await db
      .select()
      .from(goalContributions)
      .where(own(goalContributions, userId, eq(goalContributions.goalId, c.req.param('id'))))
      .orderBy(desc(goalContributions.on), desc(goalContributions.id))
    return c.json(rows.map((r) => ({ id: r.id, amount: r.amount, on: r.on, note: r.note })))
  })
  /** Add (or, with a negative amount, withdraw) money; `saved` never drops below 0. */
  .post('/:id/contributions', validate('json', goalContributionInput), async (c) => {
    const { db, userId } = c.var
    const id = c.req.param('id')
    const [goal] = await db
      .select()
      .from(goals)
      .where(own(goals, userId, eq(goals.id, id)))
    if (!goal) throw notFound()
    const body = c.req.valid('json')
    await db.batch([
      db.insert(goalContributions).values({
        id: ulid(),
        userId,
        goalId: id,
        amount: body.amount,
        on: body.on ?? todayIST(),
        note: body.note,
      }),
      db
        .update(goals)
        .set({ saved: sql`max(0, ${goals.saved} + ${body.amount})`, updatedAt: new Date() })
        .where(own(goals, userId, eq(goals.id, id))),
    ])
    const [row] = await db.select().from(goals).where(eq(goals.id, id))
    return c.json(toDto(row!), 201)
  })
