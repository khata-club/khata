import { ulid } from 'ulid'

import { DEFAULT_CATEGORIES } from '../../shared/constants'

/**
 * Seed default Indian categories and an empty prefs row for a new user.
 * One statement via json_each so it fits D1's per-query bound-parameter limit.
 */
export async function seedUser(d1: D1Database, userId: string) {
  const rows = DEFAULT_CATEGORIES.map((c) => ({
    id: ulid(),
    kind: c.kind,
    name: c.name,
    icon: c.icon,
    color: c.color,
  }))
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO fin_categories (id, user_id, kind, name, icon, color, is_default)
         SELECT j.value ->> 'id', ?1, j.value ->> 'kind', j.value ->> 'name', j.value ->> 'icon', j.value ->> 'color', 1
         FROM json_each(?2) AS j`,
      )
      .bind(userId, JSON.stringify(rows)),
    d1.prepare(`INSERT OR IGNORE INTO fin_prefs (user_id) VALUES (?1)`).bind(userId),
  ])
}
