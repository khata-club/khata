import { integer, text } from 'drizzle-orm/sqlite-core'

/** Epoch milliseconds. Stored as INTEGER so ordering and range scans stay cheap in SQLite. */
export const ms = (name: string) => integer(name, { mode: 'number' })

/** Mandatory tenant column. Every tenant-owned row carries it, and every lookup filters on it. */
export const organizationId = () => text('organization_id').notNull()

export const createdAt = () =>
  ms('created_at')
    .notNull()
    .$defaultFn(() => Date.now())

export const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>()
