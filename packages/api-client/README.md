# Public API client

Private workspace package under PolyForm Perimeter. It consumes only the reviewed `openapi.json` snapshot. Frontend builds need no access to khata-core.

`pnpm generate` regenerates committed TypeScript schemas and build-generated Ajv standalone validators. Validators run without dynamic code generation in the browser. Review contract changes as explicit commits; copy only the allowlisted export from core. Never copy migrations, implementation, credentials, or internal schemas.

`createApiClient({ baseUrl, getAccessToken, fetch })` exposes `health`, `ready`, and `me`. Token acquisition is injectable and only invoked for `me`. Requests accept `{ signal }`. Errors are `TransportError` (including cancellation, with its cause), `HttpError` (status and optional safe failure), or `ResponseValidationError`. No automatic retries, persisted sessions, redirects, or cookies.
