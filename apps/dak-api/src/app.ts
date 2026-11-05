import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'

import { createAuth } from './auth'
import type { ControlDb, EventsDb, Scoped } from './db'
import { HttpError } from './lib/errors'
import type { MemberContext } from './middleware/session'
import { dashboard } from './routes/dashboard'
import { v1 } from './routes/v1'

export type AppEnv = {
  Bindings: Env
  Variables: {
    requestId: string
    member?: MemberContext
    /** Set by API-key auth on the public API (Dak 10/22). */
    apiKey?: {
      id: string
      projectId: string
      environmentId: string
      scopes: string[]
      allowedDomains: string[]
    }
    db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> }
  }
}

export const app = new Hono<AppEnv>()

app.use(requestId({ headerName: 'x-request-id' }))
app.use(secureHeaders())

app.get('/health', (c) => c.json({ ok: true, service: 'dak-api', env: c.env.DAK_ENV }))

app.on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

app.route('/api', dashboard)
app.route('/v1', v1)

app.notFound((c) =>
  c.json(
    { error: { code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` } },
    404,
  ),
)

app.onError((err, c) => {
  if (err instanceof HttpError) {
    const retryMs = err.details?.retryAfterMs
    if (typeof retryMs === 'number')
      c.header('retry-after', String(Math.max(1, Math.ceil(retryMs / 1000))))
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details }),
        },
      },
      err.status,
    )
  }
  console.error(JSON.stringify({ level: 'error', requestId: c.get('requestId'), msg: err.message }))
  return c.json({ error: { code: 'internal_error', message: 'Internal error' } }, 500)
})
