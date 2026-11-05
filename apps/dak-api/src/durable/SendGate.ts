import { DurableObject } from 'cloudflare:workers'

/**
 * Per project × environment coordinator. Idempotency records, quota reservations, the hard
 * usage cap and per-stream token buckets live here so they are decided in one serialized step
 * (Dak 11/22). This scaffold only proves the binding and SQLite storage work.
 */
export class SendGate extends DurableObject<Env> {
  async ping(): Promise<{ ok: true; sqlite: boolean }> {
    const row = this.ctx.storage.sql.exec<{ one: number }>('SELECT 1 AS one').one()
    return { ok: true, sqlite: row.one === 1 }
  }
}
