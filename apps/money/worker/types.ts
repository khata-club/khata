import type { DB } from './db'
import type { Env } from './env'

export interface AppEnv {
  Bindings: Env
  Variables: {
    db: DB
    userId: string
    user: { id: string; name: string; email: string; image?: string | null }
  }
}
