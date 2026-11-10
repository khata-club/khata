import { testUtils } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'

import { createAuth } from '../auth'
import { getDb } from '../db'
import { user } from '../db/schema'
import type { AppEnv } from '../types'

/**
 * Local development only: sign in as a seeded demo user without Google, so the app can be
 * explored and screenshotted before OAuth credentials exist. Returns 404 unless ENVIRONMENT=dev.
 */
export const devRoutes = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    if (c.env.ENVIRONMENT !== 'dev') return c.json({ error: 'not_found' }, 404)
    await next()
  })
  .post('/login', async (c) => {
    const email = 'demo@khata.club'
    const auth = createAuth(c.env, [testUtils()])
    const ctx = await auth.$context
    const db = getDb(c.env.DB)
    let [u] = await db.select().from(user).where(eq(user.email, email))
    if (!u) {
      await ctx.test.saveUser(ctx.test.createUser({ email, name: 'Asha Rao', emailVerified: true }))
      ;[u] = await db.select().from(user).where(eq(user.email, email))
    }
    const { cookies } = await ctx.test.login({ userId: u!.id })
    for (const ck of cookies) {
      setCookie(c, ck.name, ck.value, { path: '/', httpOnly: true, sameSite: 'Lax' })
    }
    return c.json({ ok: true, userId: u!.id })
  })
