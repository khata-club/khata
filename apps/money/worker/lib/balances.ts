import { sql } from 'drizzle-orm'

import type { DB } from '../db'

export interface BalanceRow {
  id: string
  balance: number
}

/** Current balance per account: opening + income − expense − transfers out + transfers in. */
export async function accountBalances(db: DB, userId: string): Promise<Map<string, number>> {
  const rows = await db.all<BalanceRow>(sql`
    SELECT a.id AS id,
      a.opening_balance
      + COALESCE((SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
                  FROM fin_transactions t WHERE t.account_id = a.id), 0)
      + COALESCE((SELECT SUM(t.amount) FROM fin_transactions t
                  WHERE t.to_account_id = a.id AND t.type = 'transfer'), 0) AS balance
    FROM fin_accounts a
    WHERE a.user_id = ${userId}
  `)
  return new Map(rows.map((r) => [r.id, Number(r.balance)]))
}
