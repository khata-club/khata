/**
 * Priority scheduler for background media work (thumbnails, waveforms, proxies, analysis).
 *
 * - Five levels; higher levels always start first.
 * - Tasks are keyed: scheduling an existing key re-prioritises it instead of duplicating work.
 * - Every task receives an AbortSignal; cancel/cancelWhere abort queued and running work.
 * - `pauseBelow(level)` holds back lower-priority work while the user plays or scrubs. Running
 *   tasks of those levels are not killed, they finish their current step and yield.
 */
export const Priority = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  IDLE: 0,
} as const
export type Priority = (typeof Priority)[keyof typeof Priority]

export interface TaskOptions {
  key: string
  priority: Priority
  /** Optional group for bulk cancellation (e.g. an asset id). */
  group?: string
}

interface Task<T> extends TaskOptions {
  run: (signal: AbortSignal) => Promise<T>
  controller: AbortController
  resolve: (v: T) => void
  reject: (e: unknown) => void
  promise: Promise<T>
  seq: number
}

export class TaskCancelledError extends Error {
  constructor() {
    super('Task cancelled')
    this.name = 'TaskCancelledError'
  }
}

export interface SchedulerStats {
  queued: number
  running: number
  completed: number
  cancelled: number
  failed: number
  pausedBelow: Priority | null
  byPriority: Record<number, number>
}

export class PriorityScheduler {
  private queue: Task<unknown>[] = []
  private running = new Map<string, Task<unknown>>()
  private seq = 0
  private pausedBelowLevel: Priority | null = null
  private completed = 0
  private cancelled = 0
  private failed = 0

  constructor(private concurrency = 2) {}

  /** Schedule work. Same key while queued/running → returns the existing promise (re-prioritised). */
  schedule<T>(opts: TaskOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const running = this.running.get(opts.key)
    if (running) return running.promise as Promise<T>
    const queued = this.queue.find((t) => t.key === opts.key)
    if (queued) {
      if (opts.priority > queued.priority) queued.priority = opts.priority
      this.pump()
      return queued.promise as Promise<T>
    }
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    // Unobserved cancellations are expected; don't surface them as unhandled rejections.
    promise.catch(() => {})
    const task: Task<T> = {
      ...opts,
      run,
      controller: new AbortController(),
      resolve,
      reject,
      promise,
      seq: this.seq++,
    }
    this.queue.push(task as Task<unknown>)
    this.pump()
    return promise
  }

  /** Change a queued task's priority (e.g. its thumbnail scrolled into view). */
  reprioritize(key: string, priority: Priority): void {
    const t = this.queue.find((x) => x.key === key)
    if (t) {
      t.priority = priority
      this.pump()
    }
  }

  /** Apply a priority to many queued tasks, e.g. everything outside the viewport → LOW. */
  reprioritizeWhere(pred: (opts: TaskOptions) => boolean, priority: Priority): void {
    for (const t of this.queue) if (pred(t)) t.priority = priority
    this.pump()
  }

  cancel(key: string): void {
    this.cancelWhere((t) => t.key === key)
  }

  cancelGroup(group: string): void {
    this.cancelWhere((t) => t.group === group)
  }

  cancelWhere(pred: (opts: TaskOptions) => boolean): void {
    const keep: Task<unknown>[] = []
    for (const t of this.queue) {
      if (pred(t)) {
        t.controller.abort()
        t.reject(new TaskCancelledError())
        this.cancelled++
      } else keep.push(t)
    }
    this.queue = keep
    for (const t of this.running.values()) if (pred(t)) t.controller.abort()
  }

  /** Hold back queued work below `level` (null resumes everything). */
  pauseBelow(level: Priority | null): void {
    this.pausedBelowLevel = level
    this.pump()
  }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, n)
    this.pump()
  }

  has(key: string): boolean {
    return this.running.has(key) || this.queue.some((t) => t.key === key)
  }

  stats(): SchedulerStats {
    const byPriority: Record<number, number> = {}
    for (const t of this.queue) byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed,
      cancelled: this.cancelled,
      failed: this.failed,
      pausedBelow: this.pausedBelowLevel,
      byPriority,
    }
  }

  /** Resolves when nothing is queued or running (tests, export barriers). */
  async idle(): Promise<void> {
    while (this.queue.length || this.running.size) {
      const any = [...this.running.values()].map((t) => t.promise.catch(() => {}))
      if (any.length) await Promise.race(any)
      else if (this.queue.length) return // everything queued is paused
    }
  }

  private next(): Task<unknown> | undefined {
    let best: Task<unknown> | undefined
    let bi = -1
    for (let i = 0; i < this.queue.length; i++) {
      const t = this.queue[i]!
      if (this.pausedBelowLevel !== null && t.priority < this.pausedBelowLevel) continue
      if (
        !best ||
        t.priority > best.priority ||
        (t.priority === best.priority && t.seq < best.seq)
      ) {
        best = t
        bi = i
      }
    }
    if (best) this.queue.splice(bi, 1)
    return best
  }

  private pump(): void {
    while (this.running.size < this.concurrency) {
      const t = this.next()
      if (!t) return
      this.running.set(t.key, t)
      let p: Promise<unknown>
      try {
        p = t.run(t.controller.signal)
      } catch (e) {
        p = Promise.reject(e)
      }
      p.then(
        (v) => {
          this.completed++
          t.resolve(v)
        },
        (e) => {
          if (t.controller.signal.aborted) {
            this.cancelled++
            t.reject(new TaskCancelledError())
          } else {
            this.failed++
            t.reject(e)
          }
        },
      ).finally(() => {
        this.running.delete(t.key)
        this.pump()
      })
    }
  }
}
