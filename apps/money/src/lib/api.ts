/** Same-origin JSON client for the Worker API. Session cookies ride along automatically. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    issues?: { path: string; message: string }[]
  }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('khata:unauthorized'))
    const message =
      data.issues?.[0]?.message ??
      (data.error === 'validation' ? 'Check the form' : data.error) ??
      'Something went wrong'
    throw new ApiError(res.status, message, data.issues)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<void>('DELETE', path),
}

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const out = s.toString()
  return out ? `?${out}` : ''
}

/** Field → message map from a validation error, for inline form errors. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {}
  return Object.fromEntries(err.issues.map((i) => [i.path, i.message]))
}
