import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Error with a stable machine-readable code, rendered as `{ error: { code, message } }`. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}
