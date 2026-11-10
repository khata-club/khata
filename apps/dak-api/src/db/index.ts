/**
 * The only module allowed to touch D1 bindings or construct Drizzle clients (enforced by
 * ESLint). Everything else goes through `scoped()`, which makes the tenant filter mandatory.
 */
import { and, eq, type InferInsertModel, type InferSelectModel, type SQL } from 'drizzle-orm'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import * as authSchema from './auth'
import * as control from './control'
import * as events from './events'

export { authSchema, control, events }

export type ControlDb = DrizzleD1Database<typeof control & typeof authSchema>
export type EventsDb = DrizzleD1Database<typeof events>

export interface Databases {
  control: ControlDb
  events: EventsDb
}

export function databases(env: Pick<Env, 'DB' | 'DB_EVENTS'>): Databases {
  return {
    control: drizzle(env.DB, { schema: { ...control, ...authSchema } }),
    events: drizzle(env.DB_EVENTS, { schema: events }),
  }
}

/** Every tenant-owned lookup and mutation is bound to one organization. */
export interface Tenant {
  organizationId: string
}

export type TenantTable = SQLiteTable & { organizationId: SQLiteColumn }

type Db = ControlDb | EventsDb

/**
 * Tenant-bound data access. `where()` always ANDs the organization filter, inserts always set
 * it, and updates/deletes can only target the tenant's rows.
 */
export class Scoped<D extends Db = Db> {
  constructor(
    readonly db: D,
    readonly tenant: Tenant,
  ) {
    if (!tenant.organizationId) throw new Error('Scoped: organizationId is required')
  }

  where<T extends TenantTable>(table: T, ...conditions: (SQL | undefined)[]): SQL {
    return and(eq(table.organizationId, this.tenant.organizationId), ...conditions)!
  }

  async findMany<T extends TenantTable>(
    table: T,
    where?: SQL,
    options: { limit?: number; orderBy?: SQL | SQLiteColumn } = {},
  ): Promise<InferSelectModel<T>[]> {
    let q = this.db
      .select()
      .from(table as SQLiteTable)
      .where(this.where(table, where))
      .$dynamic()
    if (options.orderBy) q = q.orderBy(options.orderBy)
    if (options.limit) q = q.limit(options.limit)
    return (await q) as InferSelectModel<T>[]
  }

  async findFirst<T extends TenantTable>(
    table: T,
    where?: SQL,
  ): Promise<InferSelectModel<T> | undefined> {
    const [row] = await this.findMany(table, where, { limit: 1 })
    return row
  }

  insert<T extends TenantTable>(
    table: T,
    values:
      Omit<InferInsertModel<T>, 'organizationId'> | Omit<InferInsertModel<T>, 'organizationId'>[],
  ) {
    const rows = (Array.isArray(values) ? values : [values]).map((v) => ({
      ...v,
      organizationId: this.tenant.organizationId,
    }))
    // Generic tables defeat Drizzle's column inference; the public signature stays typed.
    return this.db.insert(table).values(rows as never)
  }

  update<T extends TenantTable>(table: T, set: Partial<InferInsertModel<T>>, where?: SQL) {
    const safe: Record<string, unknown> = { ...set }
    delete safe.organizationId
    return this.db
      .update(table)
      .set(safe as never)
      .where(this.where(table, where))
  }

  delete<T extends TenantTable>(table: T, where?: SQL) {
    return this.db.delete(table).where(this.where(table, where))
  }
}

export function scoped<D extends Db>(db: D, tenant: Tenant): Scoped<D> {
  return new Scoped(db, tenant)
}
