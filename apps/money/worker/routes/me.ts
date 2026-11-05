import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { prefsInput } from '../../shared/schemas'
import type { Me, Prefs } from '../../shared/types'
import type { DB } from '../db'
import { prefs, user } from '../db/schema'
import { validate } from '../lib/http'
import { seedUser } from '../lib/seed'
import type { AppEnv } from '../types'

const APP_TABLES = [
  'fin_transactions',
  'fin_recurring',
  'fin_budgets',
  'fin_goal_contributions',
  'fin_goals',
  'fin_holdings',
  'fin_tax_declarations',
  'fin_networth_snapshots',
  'fin_accounts',
  'fin_categories',
  'fin_prefs',
] as const

export async function getPrefs(db: DB, d1: D1Database, userId: string): Promise<Prefs> {
  let [row] = await db.select().from(prefs).where(eq(prefs.userId, userId))
  if (!row) {
    // Users created before seeding existed (or if the hook failed) get seeded lazily.
    await seedUser(d1, userId)
    ;[row] = await db.select().from(prefs).where(eq(prefs.userId, userId))
  }
  return {
    onboarded: row!.onboarded,
    analyticsConsent: row!.analyticsConsent,
    monthlyIncome: row!.monthlyIncome,
    taxSelfSenior: row!.taxSelfSenior,
    taxParents: row!.taxParents,
  }
}

export const meRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, user: u, userId } = c.var
    const body: Me = {
      user: { id: u.id, name: u.name, email: u.email, image: u.image ?? null },
      prefs: await getPrefs(db, c.env.DB, userId),
    }
    return c.json(body)
  })
  .patch('/prefs', validate('json', prefsInput), async (c) => {
    const { db, userId } = c.var
    await getPrefs(db, c.env.DB, userId)
    await db
      .update(prefs)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(prefs.userId, userId))
    return c.json(await getPrefs(db, c.env.DB, userId))
  })
  /** Wipe every entry, account and setting, then start again with default categories. */
  .delete('/data', async (c) => {
    const d1 = c.env.DB
    const userId = c.var.userId
    await d1.batch(
      APP_TABLES.map((t) => d1.prepare(`DELETE FROM ${t} WHERE user_id = ?1`).bind(userId)),
    )
    await seedUser(d1, userId)
    return c.body(null, 204)
  })
  /** Delete the user; every session and app row cascades. */
  .delete('/', async (c) => {
    await c.var.db.delete(user).where(eq(user.id, c.var.userId))
    return c.body(null, 204)
  })
