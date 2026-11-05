import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'

export type AppEnv = { Bindings: Env; Variables: { requestId: string } }

export const app = new Hono<AppEnv>()

app.use(requestId({ headerName: 'x-request-id' }))
app.use(secureHeaders())

app.get('/health', (c) => c.json({ ok: true, service: 'dak-api', env: c.env.DAK_ENV }))

app.notFound((c) =>
  c.json(
    { error: { code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` } },
    404,
  ),
)

app.onError((err, c) => {
  console.error(JSON.stringify({ level: 'error', requestId: c.get('requestId'), msg: err.message }))
  return c.json({ error: { code: 'internal_error', message: 'Internal error' } }, 500)
})
