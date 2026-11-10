import { passkeyClient } from '@better-auth/passkey/client'
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  basePath: '/auth',
  plugins: [
    organizationClient({ teams: { enabled: true } }),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.assign('/sign-in/two-factor')
      },
    }),
    passkeyClient(),
  ],
})

/** Turns a Better Auth `{ error }` result into a user-facing message. */
export function authErrorMessage(error: { message?: string; status?: number } | null | undefined) {
  if (!error) return undefined
  return error.message || 'Something went wrong. Please try again.'
}
