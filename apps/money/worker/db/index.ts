import { drizzle } from 'drizzle-orm/d1'

import { appSchema, authSchema } from './schema'

export const schema = { ...authSchema, ...appSchema }

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}
export type DB = ReturnType<typeof getDb>
