/** Same-origin fetch for the dashboard API. Throws on non-2xx with the API's error code. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { accept: 'application/json', ...init?.headers },
  })
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) {
    const code =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: { code?: string } }).error.code ?? 'http_error')
        : 'http_error'
    throw new ApiError(res.status, code)
  }
  return body as T
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API ${status}: ${code}`)
  }
}

export interface Health {
  ok: boolean
  service: string
  env: string
}
