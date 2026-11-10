import { DakError } from './errors.ts'

export interface DakOptions {
  /** A project API key: `dak_live_…` or `dak_test_…`. */
  apiKey: string
  /** Defaults to the hosted API. */
  baseUrl?: string
  /** Inject a fetch implementation (tests, proxies). Defaults to the global fetch. */
  fetch?: typeof fetch
}

export interface RequestOptions {
  /** Makes retries of the same logical request safe (spec §5). Scoped to project × environment. */
  idempotencyKey?: string
  signal?: AbortSignal
}

export const DEFAULT_BASE_URL = 'https://api.dak.khata.club'

/**
 * Low-level transport shared by the resource clients. Resource methods (emails, domains,
 * templates…) are generated from the OpenAPI document in a later change.
 */
export class Dak {
  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #fetch: typeof fetch

  constructor(options: DakOptions) {
    if (!/^dak_(live|test)_/.test(options.apiKey)) {
      throw new DakError('apiKey must start with dak_live_ or dak_test_', 0, 'invalid_api_key')
    }
    this.#apiKey = options.apiKey
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.#apiKey}`,
      accept: 'application/json',
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey

    let res: Response
    try {
      res = await this.#fetch(`${this.#baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      })
    } catch (cause) {
      throw new DakError(
        cause instanceof Error ? cause.message : 'Network error',
        0,
        'network_error',
      )
    }

    const requestId = res.headers.get('x-request-id') ?? undefined
    const text = await res.text()
    const data: unknown = text ? safeJson(text) : undefined

    if (!res.ok) {
      const err = isErrorBody(data) ? data.error : undefined
      throw new DakError(
        err?.message ?? `Request failed with status ${res.status}`,
        res.status,
        err?.code ?? 'http_error',
        requestId,
      )
    }
    return data as T
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isErrorBody(v: unknown): v is { error: { code?: string; message?: string } } {
  return typeof v === 'object' && v !== null && 'error' in v && typeof v.error === 'object'
}
