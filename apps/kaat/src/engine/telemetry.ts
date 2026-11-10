/**
 * Engine telemetry for the diagnostics panel and adaptive quality. Everything is a fixed-size ring,
 * so recording costs O(1) and memory never grows with session length.
 */
import type { ErrorCode } from '@khata/kaat-core'

export class Ring {
  private buf: Float64Array
  private i = 0
  private n = 0
  constructor(size = 120) {
    this.buf = new Float64Array(size)
  }
  push(v: number): void {
    this.buf[this.i] = v
    this.i = (this.i + 1) % this.buf.length
    if (this.n < this.buf.length) this.n++
  }
  get count(): number {
    return this.n
  }
  values(): number[] {
    return Array.from(this.buf.subarray(0, this.n))
  }
  percentile(p: number): number {
    if (!this.n) return 0
    const v = this.values().sort((a, b) => a - b)
    return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))]!
  }
  mean(): number {
    if (!this.n) return 0
    let s = 0
    for (let k = 0; k < this.n; k++) s += this.buf[k]!
    return s / this.n
  }
  clear(): void {
    this.i = 0
    this.n = 0
  }
}

export interface EngineErrorRecord {
  at: number
  code: ErrorCode
  message: string
}

class Telemetry {
  readonly renderMs = new Ring(120)
  readonly decodeMs = new Ring(120)
  readonly seekMs = new Ring(200)
  readonly frameIntervals = new Ring(120)
  readonly autosaveMs = new Ring(30)
  readonly timelineDrawMs = new Ring(120)
  droppedFrames = 0
  presentedFrames = 0
  previewScale = 1
  previewQuality = 'auto'
  liveFrames = 0
  frameCacheHitRate = 0
  frameCacheBytes = 0
  thumbCacheBytes = 0
  pcmCacheBytes = 0
  backgroundQueue = 0
  backgroundRunning = 0
  exportState = 'idle'
  storageUsage = 0
  storageQuota = 0
  readonly errors: EngineErrorRecord[] = []

  private lastFrameAt = 0

  /** Call when a frame is presented during playback. */
  framePresented(now = performance.now()): void {
    if (this.lastFrameAt) this.frameIntervals.push(now - this.lastFrameAt)
    this.lastFrameAt = now
    this.presentedFrames++
  }

  resetFrameClock(): void {
    this.lastFrameAt = 0
    this.frameIntervals.clear()
  }

  fps(): number {
    const m = this.frameIntervals.mean()
    return m ? 1000 / m : 0
  }

  error(code: ErrorCode, message: string): void {
    this.errors.unshift({ at: Date.now(), code, message })
    if (this.errors.length > 20) this.errors.length = 20
  }
}

export const telemetry = new Telemetry()
