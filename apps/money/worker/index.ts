import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'

import { createAuth } from './auth'
import { getDb } from './db'
import { accountRoutes } from './routes/accounts'
import { budgetRoutes } from './routes/budgets'
import { categoryRoutes } from './routes/categories'
import { csvRoutes } from './routes/csv'
import { devRoutes } from './routes/dev'
import { goalRoutes } from './routes/goals'
import { holdingRoutes } from './routes/holdings'
import { meRoutes } from './routes/me'
import { recurringRoutes } from './routes/recurring'
import { reportRoutes } from './routes/reports'
import { transactionRoutes } from './routes/transactions'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>().basePath('/api')

app.use('*', secureHeaders())
app.get('/health', (c) => c.json({ ok: true }))

// Better Auth: Google sign-in, callback, session and sign-out.
app.on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

// Dev-only helpers (seeded sign-in for local runs and screenshots). 404 in production.
app.route('/dev', devRoutes)

// Everything else needs a signed-in user.
app.use('*', async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', session.user)
  c.set('userId', session.user.id)
  c.set('db', getDb(c.env.DB))
  await next()
})

app.route('/me', meRoutes)
app.route('/accounts', accountRoutes)
app.route('/categories', categoryRoutes)
app.route('/transactions', transactionRoutes)
app.route('/budgets', budgetRoutes)
app.route('/recurring', recurringRoutes)
app.route('/goals', goalRoutes)
app.route('/holdings', holdingRoutes)
app.route('/reports', reportRoutes)
app.route('/', csvRoutes)

app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'internal' }, 500)
})

export default app satisfies ExportedHandler<AppEnv['Bindings']>
