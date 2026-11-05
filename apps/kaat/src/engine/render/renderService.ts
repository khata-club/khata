/**
 * Main-thread handle on the render worker. Requests are latest-wins: while a frame renders, only
 * the newest requested time is kept, so rapid seeking never queues work. Auto quality lowers the
 * preview resolution when playback falls behind and restores full quality when paused.
 */
import type { Project } from '@khata/kaat-core'

import { Emitter } from '../emitter'
import { BUNDLED_FONTS } from '../fonts'
import { type Client, createClient } from '../rpc'
import { Ring, telemetry } from '../telemetry'
import type { RenderApi, RenderResult } from './protocol'
import RenderWorker from './render.worker?worker'

export type PreviewQuality = 'auto' | 'full' | 'half' | 'quarter'
export type RenderMode = 'still' | 'scrub' | 'play'

const FIXED_SCALE: Record<Exclude<PreviewQuality, 'auto'>, number> = {
  full: 1,
  half: 0.5,
  quarter: 0.25,
}
const AUTO_STEPS = [1, 0.75, 0.5, 0.33, 0.25]

type Events = { frame: RenderResult & { t: number; mode: RenderMode }; error: unknown }

export class RenderService extends Emitter<Events> {
  readonly api: Client<RenderApi>
  readonly ready: Promise<boolean>
  private busy = false
  private pending?: { t: number; mode: RenderMode }
  private projectQueued?: Project
  private projectPosting = false
  quality: PreviewQuality = 'auto'
  private autoStep = 0
  private playRenderMs = new Ring(30)
  private lastAdapt = 0
  private stillTimer = 0
  private lastT = 0
  frameBudgetMs = 1000 / 30
  private cssW = 1280
  private cssH = 720

  constructor(canvas: HTMLCanvasElement) {
    super()
    const worker = new RenderWorker({ name: 'kaat-render' })
    this.api = createClient<RenderApi>(worker).api
    const offscreen = canvas.transferControlToOffscreen()
    const budget = this.textureBudget()
    this.ready = this.api.init(offscreen, BUNDLED_FONTS, budget, { transfer: [offscreen] })
  }

  private textureBudget(): number {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
    return Math.min(768, Math.max(192, mem * 48)) * 1024 * 1024
  }

  setViewport(cssW: number, cssH: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.cssW = Math.max(16, cssW * dpr)
    this.cssH = Math.max(16, cssH * dpr)
  }

  /** Post the latest project; coalesces bursts of edits into one structured clone. */
  setProject(p: Project): void {
    this.projectQueued = p
    if (this.projectPosting) return
    this.projectPosting = true
    queueMicrotask(async () => {
      try {
        while (this.projectQueued) {
          const next = this.projectQueued
          this.projectQueued = undefined
          await this.api.setProject(next)
        }
      } finally {
        this.projectPosting = false
      }
      this.request(this.lastT, 'still')
    })
  }

  setSource(assetId: string, original: Blob | undefined, proxy?: Blob): Promise<void> {
    return this.api.setSource(assetId, original ?? null, proxy ?? null)
  }

  removeSource(assetId: string): Promise<void> {
    return this.api.removeSource(assetId)
  }

  currentScale(mode: RenderMode): number {
    if (this.quality !== 'auto') return FIXED_SCALE[this.quality]
    if (mode === 'still') return 1
    if (mode === 'scrub') return Math.min(AUTO_STEPS[this.autoStep]!, 0.75)
    return AUTO_STEPS[this.autoStep]!
  }

  /** Ask for a frame. Returns immediately; the result arrives as a `frame` event. */
  request(t: number, mode: RenderMode): void {
    this.lastT = t
    if (this.busy) {
      if (this.pending && this.pending.mode === 'play') telemetry.droppedFrames++
      this.pending = { t, mode }
      return
    }
    void this.run(t, mode)
    // After scrubbing stops, re-render at full quality.
    if (mode === 'scrub') {
      clearTimeout(this.stillTimer)
      this.stillTimer = window.setTimeout(() => this.request(this.lastT, 'still'), 140)
    }
  }

  private async run(t: number, mode: RenderMode): Promise<void> {
    this.busy = true
    await this.ready
    const scale = this.currentScale(mode)
    const sent = performance.now()
    try {
      const r = await this.api.render(t, mode, scale, this.cssW, this.cssH)
      const latency = performance.now() - sent
      telemetry.renderMs.push(r.renderMs)
      telemetry.decodeMs.push(r.decodeMs)
      if (mode !== 'play') telemetry.seekMs.push(latency)
      telemetry.previewScale = scale
      if (mode === 'play') {
        this.playRenderMs.push(latency)
        telemetry.framePresented()
        this.adapt()
      }
      this.emit('frame', { ...r, t, mode })
    } catch (e) {
      telemetry.error('RENDER_FAILED', e instanceof Error ? e.message : String(e))
      this.emit('error', e)
    } finally {
      this.busy = false
      const p = this.pending
      this.pending = undefined
      if (p) this.request(p.t, p.mode)
    }
  }

  /** Auto quality: step down when frames take longer than the budget, step up with headroom. */
  private adapt(): void {
    if (this.quality !== 'auto') return
    const now = performance.now()
    if (now - this.lastAdapt < 600 || this.playRenderMs.count < 10) return
    const p75 = this.playRenderMs.percentile(75)
    if (p75 > this.frameBudgetMs * 0.9 && this.autoStep < AUTO_STEPS.length - 1) {
      this.autoStep++
      this.lastAdapt = now
      this.playRenderMs.clear()
    } else if (
      p75 < this.frameBudgetMs * 0.45 &&
      this.autoStep > 0 &&
      now - this.lastAdapt > 3000
    ) {
      this.autoStep--
      this.lastAdapt = now
      this.playRenderMs.clear()
    }
  }

  playbackStopped(): void {
    void this.api.stopPlayback()
    this.request(this.lastT, 'still')
  }

  setQuality(q: PreviewQuality): void {
    this.quality = q
    telemetry.previewQuality = q
    if (q !== 'auto') this.autoStep = 0
    this.request(this.lastT, 'still')
  }

  async capture(t: number): Promise<ArrayBuffer | null> {
    await this.ready
    return this.api.capture(t)
  }
}
