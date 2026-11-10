/**
 * Secrets set with `wrangler secret put` (and `.dev.vars` locally). Merged into the generated
 * `Env` interfaces so handlers and tests see them typed.
 */
interface DakSecrets {
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env extends DakSecrets {}

declare namespace Cloudflare {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env extends DakSecrets {}
}
