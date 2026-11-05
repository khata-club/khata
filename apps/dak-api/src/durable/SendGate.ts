import { DurableObject } from 'cloudflare:workers'

/**
 * Per project × environment coordinator. Idempotency records, quota reservations, the hard
 * usage cap and per-stream token buckets are decided here in one serialized step: a Durable
 * Object processes one call at a time and its SQLite writes are atomic with the call, which
 * D1 alone cannot offer (no interactive transactions).
 */

export interface GateLimits {
  /** Hard cap on recipients per calendar month (UTC); null = unlimited. */
  monthlyRecipientCap: number | null
  /** Token buckets: sustained requests per second per stream, burst = 2 × rate. */
  ratePerSecond: Record<string, number>
}

export const DEFAULT_LIMITS: GateLimits = {
  monthlyRecipientCap: null,
  // Authentication keeps the largest budget so campaigns can never starve OTPs.
  ratePerSecond: { authentication: 50, transactional: 40, notifications: 20, marketing: 10 },
}

/** Idempotency records are kept for 24 hours (spec §5). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

export interface ReserveInput {
  idempotencyKey?: string
  /** Hash of the canonical request body; a changed payload under the same key conflicts. */
  payloadHash: string
  emailId: string
  stream: string
  recipients: number
  now?: number
}

export type ReserveResult =
  | { status: 'reserved'; period: string }
  | { status: 'replay'; response: string }
  | { status: 'in_progress' }
  | { status: 'conflict' }
  | { status: 'rate_limited'; retryAfterMs: number }
  | { status: 'quota_exceeded'; cap: number; used: number }

function period(now: number) {
  return new Date(now).toISOString().slice(0, 7)
}

export class SendGate extends DurableObject<Env> {
  private readonly sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS idempotency (
        key TEXT PRIMARY KEY,
        payload_hash TEXT NOT NULL,
        email_id TEXT NOT NULL,
        state TEXT NOT NULL,
        response TEXT,
        recipients INTEGER NOT NULL,
        period TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idempotency_created ON idempotency (created_at);
      CREATE TABLE IF NOT EXISTS bucket (stream TEXT PRIMARY KEY, tokens REAL NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS usage (period TEXT PRIMARY KEY, reserved INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    `)
  }

  limits(): GateLimits {
    const row = this.sql.exec<{ v: string }>("SELECT v FROM config WHERE k = 'limits'").toArray()[0]
    return row
      ? { ...DEFAULT_LIMITS, ...(JSON.parse(row.v) as Partial<GateLimits>) }
      : DEFAULT_LIMITS
  }

  configure(limits: Partial<GateLimits>): GateLimits {
    const next = { ...this.limits(), ...limits }
    this.sql.exec("INSERT OR REPLACE INTO config (k, v) VALUES ('limits', ?)", JSON.stringify(next))
    return next
  }

  usage(now = Date.now()): { period: string; reserved: number; cap: number | null } {
    const p = period(now)
    const row = this.sql
      .exec<{ reserved: number }>('SELECT reserved FROM usage WHERE period = ?', p)
      .toArray()[0]
    return { period: p, reserved: row?.reserved ?? 0, cap: this.limits().monthlyRecipientCap }
  }

  /**
   * Atomically: replay or reject a reused idempotency key, take a rate-limit token, and
   * reserve quota for the recipients. Nothing is reserved unless every check passes.
   */
  reserve(input: ReserveInput): ReserveResult {
    const now = input.now ?? Date.now()
    this.sql.exec('DELETE FROM idempotency WHERE created_at < ?', now - IDEMPOTENCY_TTL_MS)

    if (input.idempotencyKey) {
      const prior = this.sql
        .exec<{ payload_hash: string; state: string; response: string | null }>(
          'SELECT payload_hash, state, response FROM idempotency WHERE key = ?',
          input.idempotencyKey,
        )
        .toArray()[0]
      if (prior) {
        if (prior.payload_hash !== input.payloadHash) return { status: 'conflict' }
        if (prior.state !== 'committed') return { status: 'in_progress' }
        return { status: 'replay', response: prior.response! }
      }
    }

    const limits = this.limits()
    const rate = limits.ratePerSecond[input.stream] ?? 10
    const burst = rate * 2
    const b = this.sql
      .exec<{ tokens: number; updated_at: number }>(
        'SELECT tokens, updated_at FROM bucket WHERE stream = ?',
        input.stream,
      )
      .toArray()[0]
    const tokens = Math.min(
      burst,
      (b?.tokens ?? burst) + ((now - (b?.updated_at ?? now)) / 1000) * rate,
    )
    if (tokens < 1)
      return { status: 'rate_limited', retryAfterMs: Math.ceil(((1 - tokens) / rate) * 1000) }

    const p = period(now)
    const used =
      this.sql
        .exec<{ reserved: number }>('SELECT reserved FROM usage WHERE period = ?', p)
        .toArray()[0]?.reserved ?? 0
    if (
      limits.monthlyRecipientCap !== null &&
      used + input.recipients > limits.monthlyRecipientCap
    ) {
      return { status: 'quota_exceeded', cap: limits.monthlyRecipientCap, used }
    }

    this.sql.exec(
      'INSERT OR REPLACE INTO bucket (stream, tokens, updated_at) VALUES (?, ?, ?)',
      input.stream,
      tokens - 1,
      now,
    )
    this.sql.exec(
      'INSERT INTO usage (period, reserved) VALUES (?, ?) ON CONFLICT (period) DO UPDATE SET reserved = reserved + excluded.reserved',
      p,
      input.recipients,
    )
    if (input.idempotencyKey) {
      this.sql.exec(
        "INSERT INTO idempotency (key, payload_hash, email_id, state, recipients, period, created_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)",
        input.idempotencyKey,
        input.payloadHash,
        input.emailId,
        input.recipients,
        p,
        now,
      )
    }
    return { status: 'reserved', period: p }
  }

  /** Durable acceptance succeeded: future requests with the key replay `response`. */
  commit(idempotencyKey: string | undefined, response: unknown): void {
    if (!idempotencyKey) return
    this.sql.exec(
      "UPDATE idempotency SET state = 'committed', response = ? WHERE key = ?",
      JSON.stringify(response),
      idempotencyKey,
    )
  }

  /**
   * Gives back quota: the D1 write failed (also forgets the key so a retry can proceed), or
   * recipients were suppressed or cancelled before submission.
   */
  release(input: {
    idempotencyKey?: string
    recipients: number
    period?: string
    now?: number
  }): void {
    const p = input.period ?? period(input.now ?? Date.now())
    this.sql.exec(
      'UPDATE usage SET reserved = MAX(0, reserved - ?) WHERE period = ?',
      input.recipients,
      p,
    )
    if (input.idempotencyKey) {
      this.sql.exec(
        "DELETE FROM idempotency WHERE key = ? AND state = 'pending'",
        input.idempotencyKey,
      )
    }
  }

  async ping(): Promise<{ ok: true; sqlite: boolean }> {
    const row = this.sql.exec<{ one: number }>('SELECT 1 AS one').one()
    return { ok: true, sqlite: row.one === 1 }
  }
}

export function gateName(projectId: string, environmentId: string) {
  return `${projectId}:${environmentId}`
}
