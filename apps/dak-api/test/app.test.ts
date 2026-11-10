import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('dak-api', () => {
  it('reports health', async () => {
    const res = await exports.default.fetch('https://dak.test/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBeTruthy()
    expect(await res.json()).toEqual({ ok: true, service: 'dak-api', env: 'development' })
  })

  it('returns JSON errors for unknown routes', async () => {
    const res = await exports.default.fetch('https://dak.test/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: { code: 'not_found' } })
  })

  it('binds both D1 databases', async () => {
    for (const db of [env.DB, env.DB_EVENTS]) {
      const row = await db.prepare('SELECT 1 AS one').first<{ one: number }>()
      expect(row?.one).toBe(1)
    }
  })

  it('reaches a SendGate with SQLite storage', async () => {
    const gate = env.SEND_GATE.getByName('prj_test:env_test')
    expect(await gate.ping()).toEqual({ ok: true, sqlite: true })
  })
})
