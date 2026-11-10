import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization, twoFactor } from 'better-auth/plugins'

import { ulid } from '@khata/dak-core'

import { authSchema, databases } from '../db'
import { sendAuthEmail } from './mail'
import { ac, roles } from './permissions'

export type AuthEnv = Pick<
  Env,
  'DB' | 'DB_EVENTS' | 'DAK_ENV' | 'DAK_APP_URL' | 'BETTER_AUTH_SECRET'
> &
  Partial<
    Pick<Env, 'AWS_ACCESS_KEY_ID' | 'AWS_SECRET_ACCESS_KEY' | 'DAK_AUTH_FROM' | 'DAK_SES_REGION'>
  >

const AUTH_ID_PREFIXES: Record<string, string> = {
  organization: 'org',
  team: 'ws',
  user: 'usr',
  session: 'ses',
  account: 'acc',
  verification: 'vrf',
  member: 'mem',
  invitation: 'inv',
  teamMember: 'tmm',
  twoFactor: 'tfa',
  passkey: 'psk',
}

/**
 * Better Auth bound to this request's D1 binding. Workers bindings are per-request, so the
 * instance is built per call; construction is cheap (no I/O).
 */
export function createAuth(env: AuthEnv) {
  const db = databases(env).control
  const appUrl = new URL(env.DAK_APP_URL)

  return betterAuth({
    appName: 'Dak',
    baseURL: env.DAK_APP_URL,
    basePath: '/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl.origin],
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    advanced: {
      cookiePrefix: 'dak',
      database: {
        // Prefixed ULIDs like the rest of Dak: org_…, ws_… (teams), usr_…
        generateId: ({ model }) => `${AUTH_ID_PREFIXES[model] ?? model.slice(0, 3)}_${ulid()}`,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.DAK_ENV === 'production',
      minPasswordLength: 12,
      sendResetPassword: async ({ user, url }) =>
        sendAuthEmail(env, {
          to: user.email,
          subject: 'Reset your Dak password',
          text: `Reset your password: ${url}\n\nIf you did not ask for this, ignore this email.`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        sendAuthEmail(env, {
          to: user.email,
          subject: 'Verify your email for Dak',
          text: `Confirm your email address: ${url}`,
        }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // No cookie cache: the active organization and role must never be stale.
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: env.DAK_ENV === 'production', window: 60, max: 100 },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: 'owner',
        teams: { enabled: true, allowRemovingAllTeams: false },
        invitationExpiresIn: 60 * 60 * 24 * 7,
        sendInvitationEmail: async ({ email, organization, inviter, id }) =>
          sendAuthEmail(env, {
            to: email,
            subject: `${inviter.user.name} invited you to ${organization.name} on Dak`,
            text: `Accept the invitation: ${env.DAK_APP_URL}/invite/${id}`,
          }),
      }),
      twoFactor({ issuer: 'Dak' }),
      passkey({ rpID: appUrl.hostname, rpName: 'Dak', origin: appUrl.origin }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth['$Infer']['Session']
