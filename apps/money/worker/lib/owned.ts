import { and, eq, inArray, type SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

import type { DB } from '../db'
import { accounts, categories, holdings } from '../db/schema'
import { badRequest } from './http'

/**
 * Tenant scope: every query on an app table goes through `own(table, userId)` so the
 * user filter cannot be forgotten.
 */
export function own(table: { userId: SQLiteColumn }, userId: string, ...more: (SQL | undefined)[]) {
  return and(eq(table.userId, userId), ...more)!
}

/** Throws 400 unless every referenced account/category/holding belongs to this user. */
export async function assertRefs(
  db: DB,
  userId: string,
  refs: {
    accountIds?: (string | null | undefined)[]
    categoryId?: string | null
    holdingId?: string | null
  },
) {
  const accountIds = [...new Set((refs.accountIds ?? []).filter((x): x is string => !!x))]
  if (accountIds.length) {
    const found = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(own(accounts, userId, inArray(accounts.id, accountIds)))
    if (found.length !== accountIds.length) throw badRequest('Unknown account')
  }
  if (refs.categoryId) {
    const found = await db
      .select({ id: categories.id })
      .from(categories)
      .where(own(categories, userId, eq(categories.id, refs.categoryId)))
    if (!found.length) throw badRequest('Unknown category')
  }
  if (refs.holdingId) {
    const found = await db
      .select({ id: holdings.id })
      .from(holdings)
      .where(own(holdings, userId, eq(holdings.id, refs.holdingId)))
    if (!found.length) throw badRequest('Unknown holding')
  }
}
