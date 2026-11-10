/**
 * Minimal typed RPC over postMessage, used for every worker. Requests carry ids; results and
 * errors come back by id. Callers can cancel with an AbortSignal: the worker-side handler gets
 * its own signal and should stop work promptly. Values wrapped with `transfer()` move instead of
 * copying (ImageBitmaps, PCM buffers, VideoFrames).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Api = Record<string, (...args: any[]) => any>

const TRANSFER = Symbol('transfer')
interface Transferring<T> {
  [TRANSFER]: Transferable[]
  value: T
}

export function transfer<T>(value: T, transferables: Transferable[]): T {
  return { [TRANSFER]: transferables, value } as unknown as T
}

function unwrap(v: unknown): { value: unknown; transferables: Transferable[] } {
  if (v && typeof v === 'object' && TRANSFER in v) {
    const t = v as Transferring<unknown>
    return { value: t.value, transferables: t[TRANSFER] }
  }
  return { value: v, transferables: [] }
}

type Msg =
  | { kind: 'call'; id: number; method: string; args: unknown[] }
  | { kind: 'cancel'; id: number }
  | { kind: 'result'; id: number; value: unknown }
  | { kind: 'error'; id: number; error: { name: string; message: string; code?: string } }
  | { kind: 'event'; name: string; payload: unknown }

interface Endpoint {
  postMessage(m: unknown, transfer?: Transferable[]): void
  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void
}

export type Client<A extends Api> = {
  [K in keyof A]: (
    ...args: [...Parameters<A[K]>, CallOptions?]
  ) => Promise<Awaited<ReturnType<A[K]>>>
}

export interface CallOptions {
  signal?: AbortSignal
  transfer?: Transferable[]
}

export class RpcError extends Error {
  code?: string
  constructor(name: string, message: string, code?: string) {
    super(message)
    this.name = name
    this.code = code
  }
}

/** Main-thread side. */
export function createClient<A extends Api>(
  worker: Endpoint,
  onEvent?: (name: string, payload: unknown) => void,
): { api: Client<A>; pending: () => number } {
  let nextId = 1
  const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()
  worker.addEventListener('message', (e: MessageEvent<Msg>) => {
    const m = e.data
    if (m.kind === 'result') {
      waiting.get(m.id)?.resolve(m.value)
      waiting.delete(m.id)
    } else if (m.kind === 'error') {
      waiting.get(m.id)?.reject(new RpcError(m.error.name, m.error.message, m.error.code))
      waiting.delete(m.id)
    } else if (m.kind === 'event') onEvent?.(m.name, m.payload)
  })
  const api = new Proxy({} as Client<A>, {
    get(_, method: string) {
      return (...all: unknown[]) => {
        // A trailing CallOptions object is recognised by its keys.
        const last = all[all.length - 1] as CallOptions | undefined
        const isOpts =
          !!last &&
          typeof last === 'object' &&
          !Array.isArray(last) &&
          Object.keys(last).length > 0 &&
          Object.keys(last).every((k) => k === 'signal' || k === 'transfer')
        const opts = isOpts ? (all.pop() as CallOptions) : undefined
        const id = nextId++
        return new Promise((resolve, reject) => {
          if (opts?.signal?.aborted) {
            reject(new RpcError('AbortError', 'Aborted'))
            return
          }
          waiting.set(id, { resolve, reject })
          opts?.signal?.addEventListener(
            'abort',
            () => {
              worker.postMessage({ kind: 'cancel', id } satisfies Msg)
              waiting.get(id)?.reject(new RpcError('AbortError', 'Aborted'))
              waiting.delete(id)
            },
            { once: true },
          )
          worker.postMessage(
            { kind: 'call', id, method, args: all } satisfies Msg,
            opts?.transfer ?? [],
          )
        })
      }
    },
  })
  return { api, pending: () => waiting.size }
}

/** Handler type on the worker side: receives the call's AbortSignal as the last argument. */
export type Handlers<A extends Api> = {
  [K in keyof A]: (...args: [...Parameters<A[K]>, AbortSignal]) => ReturnType<A[K]>
}

/** Worker side. Returns an `emit` for pushing events (progress) to the main thread. */
export function expose<A extends Api>(
  scope: Endpoint,
  handlers: Handlers<A>,
): (name: string, payload: unknown, transferables?: Transferable[]) => void {
  const controllers = new Map<number, AbortController>()
  scope.addEventListener('message', async (e: MessageEvent<Msg>) => {
    const m = e.data
    if (m.kind === 'cancel') {
      controllers.get(m.id)?.abort()
      return
    }
    if (m.kind !== 'call') return
    const fn = (handlers as Record<string, (...a: unknown[]) => unknown>)[m.method]
    const ac = new AbortController()
    controllers.set(m.id, ac)
    try {
      if (!fn) throw new Error(`Unknown method ${m.method}`)
      const out = await fn(...m.args, ac.signal)
      const { value, transferables } = unwrap(out)
      scope.postMessage({ kind: 'result', id: m.id, value } satisfies Msg, transferables)
    } catch (err) {
      const er = err as { name?: string; message?: string; code?: string }
      scope.postMessage({
        kind: 'error',
        id: m.id,
        error: {
          name: ac.signal.aborted ? 'AbortError' : (er?.name ?? 'Error'),
          message: er?.message ?? String(err),
          code: er?.code,
        },
      } satisfies Msg)
    } finally {
      controllers.delete(m.id)
    }
  })
  return (name, payload, transferables = []) =>
    scope.postMessage({ kind: 'event', name, payload } satisfies Msg, transferables)
}

export function isAbort(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError'
}
