/** An error response from the Dak API, or a transport failure before one arrived. */
export class DakError extends Error {
  override readonly name = 'DakError'

  constructor(
    message: string,
    /** HTTP status, or 0 when the request never got a response. */
    readonly status: number,
    /** Stable machine-readable code, e.g. `idempotency_conflict`. */
    readonly code: string,
    /** Request ID to quote to support. */
    readonly requestId?: string,
  ) {
    super(message)
  }
}
