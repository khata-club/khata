import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { getDb } from './db'
import { authSchema } from './db/schema'
import type { Env } from './env'
import { seedUser } from './lib/seed'

/**
 * Better Auth on D1. Built per request because the D1 binding lives on `env`.
 * Sign-in is Google only; sessions are cookie-based on the same origin as the SPA.
 */
export function createAuth<P extends BetterAuthPlugin[] = []>(env: Env, plugins?: P) {
  return betterAuth({
    appName: 'khata money',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    telemetry: { enabled: false },
    database: drizzleAdapter(getDb(env.DB), { provider: 'sqlite', schema: authSchema }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      useSecureCookies: env.ENVIRONMENT === 'production',
    },
    databaseHooks: {
      user: {
        create: {
          after: async (u) => {
            await seedUser(env.DB, u.id)
          },
        },
      },
    },
    plugins: plugins ?? [],
  })
}

export type Auth = ReturnType<typeof createAuth>
