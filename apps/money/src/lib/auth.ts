import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({ basePath: '/api/auth' })

export function signInWithGoogle() {
  return authClient.signIn.social({ provider: 'google', callbackURL: '/app?signed_in=1' })
}

export async function signOut() {
  await authClient.signOut()
}
