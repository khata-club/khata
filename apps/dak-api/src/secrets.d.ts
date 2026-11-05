/**
 * Secrets set with `wrangler secret put` (and `.dev.vars` locally). Merged into the generated
 * `Env` interface so handlers see them typed.
 */
interface Env {
  /** ≥ 32 random bytes; signs sessions and verification tokens. */
  BETTER_AUTH_SECRET: string
  /** Platform broker credentials (see docs/dak/PLAN.md, decision D2). */
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  /** Base64 32-byte key for envelope-encrypting stored secrets (AES-GCM). */
  DAK_DATA_KEY?: string
  DAK_AUTH_FROM?: string
  DAK_SES_REGION?: string
}
