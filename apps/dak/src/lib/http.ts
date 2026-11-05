import { api } from './api'

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const http = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body?: unknown) => api<T>(path, json('POST', body)),
  patch: <T>(path: string, body?: unknown) => api<T>(path, json('PATCH', body)),
  put: <T>(path: string, body?: unknown) => api<T>(path, json('PUT', body)),
  del: (path: string) => api<void>(path, { method: 'DELETE' }),
}
