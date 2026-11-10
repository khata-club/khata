/**
 * Main-thread side of media processing: probing, thumbnails, waveforms, preview PCM and proxies.
 * All derived work runs in media workers through the priority scheduler; the editor never waits
 * for any of it. Every cache here is byte-bounded.
 */
import { LruCache, Priority, PriorityScheduler, TaskCancelledError } from '@khata/kaat-core'

import { Emitter } from '../emitter'
import { idbGet, idbPut } from '../persist/db'
import { type Client, createClient, isAbort } from '../rpc'
import { telemetry } from '../telemetry'
import MediaWorker from './media.worker?worker'
import type { MediaApi, Pcm, ProbeResult, WaveformChunk } from './protocol'

export const THUMB_HEIGHT = 44
/** Thumbnail sampling intervals in seconds; each zoom level picks the smallest that fits. */
const THUMB_LEVELS = [1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
export const WAVEFORM_PPS = 400
export const PCM_CHUNK_SECONDS = 4

export interface Waveform {
  pps: number
  peaks: Int8Array
  length: number
  done: boolean
  mips: Map<number, { peaks: Int8Array; length: number }>
}

type Events = {
  thumb: { assetId: string }
  waveform: { assetId: string }
  proxy: { assetId: string; progress: number }
  pcm: { assetId: string; chunk: number }
}

export interface PcmChunk {
  buffer: AudioBuffer
  /** Source time (seconds, file timestamps) of the buffer's first sample. */
  start: number
}

export class MediaService extends Emitter<Events> {
  readonly scheduler = new PriorityScheduler(2)
  private workers: Client<MediaApi>[] = []
  private thumbs = new LruCache<string, ImageBitmap>(96 * 1024 * 1024, (_, b) => b.close())
  private thumbPending = new Set<string>()
  private thumbWanted = new Map<
    string,
    { assetId: string; level: number; index: number; file: Blob; duration: number }
  >()
  private waveforms = new Map<string, Waveform>()
  private waveformKeys = new Map<string, string>() // assetId → cache key
  private pcm: LruCache<string, PcmChunk>
  private pcmPending = new Map<string, Promise<PcmChunk | null>>()

  constructor(private readonly audioCtx: () => BaseAudioContext) {
    super()
    const n = Math.max(1, Math.min(3, Math.floor((navigator.hardwareConcurrency || 4) / 3)))
    for (let i = 0; i < n; i++) {
      const w = new MediaWorker({ name: `kaat-media-${i}` })
      const { api } = createClient<MediaApi>(w, (name, payload) =>
        this.onWorkerEvent(name, payload),
      )
      this.workers.push(api)
    }
    this.pcm = new LruCache<string, PcmChunk>(256 * 1024 * 1024)
  }

  private worker(assetId: string): Client<MediaApi> {
    let h = 0
    for (let i = 0; i < assetId.length; i++) h = (h * 31 + assetId.charCodeAt(i)) | 0
    return this.workers[Math.abs(h) % this.workers.length]!
  }

  probe(assetId: string, file: File): Promise<ProbeResult> {
    return this.worker(assetId).probe(file, file.name)
  }

  // ── thumbnails ──────────────────────────────────────────────────────────────────────────────

  static thumbLevel(pxPerSecond: number, thumbWidth: number): number {
    const ideal = thumbWidth / Math.max(1e-6, pxPerSecond)
    for (let i = 0; i < THUMB_LEVELS.length; i++) if (THUMB_LEVELS[i]! >= ideal) return i
    return THUMB_LEVELS.length - 1
  }

  static levelSeconds(level: number): number {
    return THUMB_LEVELS[level]!
  }

  /**
   * Best available thumbnail for `index` at `level`: exact if cached, else the nearest coarser
   * level's thumbnail covering the same time. Missing exact thumbs are queued for generation.
   */
  thumb(
    assetId: string,
    file: Blob | undefined,
    duration: number,
    level: number,
    index: number,
  ): ImageBitmap | undefined {
    const key = `${assetId}:${level}:${index}`
    const hit = this.thumbs.get(key)
    if (hit) return hit
    if (file && !this.thumbPending.has(key))
      this.thumbWanted.set(key, { assetId, level, index, file, duration })
    const t = (index + 0.5) * THUMB_LEVELS[level]!
    for (let l = level + 1; l < THUMB_LEVELS.length; l++) {
      const b = this.thumbs.peek(`${assetId}:${l}:${Math.floor(t / THUMB_LEVELS[l]!)}`)
      if (b) return b
    }
    for (let l = level - 1; l >= 0; l--) {
      const b = this.thumbs.peek(`${assetId}:${l}:${Math.floor(t / THUMB_LEVELS[l]!)}`)
      if (b) return b
    }
    return undefined
  }

  /** Send the thumbnails requested during the last timeline draw; older queued work drops to LOW. */
  flushThumbs(): void {
    const wanted = this.thumbWanted
    this.thumbWanted = new Map()
    this.scheduler.reprioritizeWhere((t) => t.key.startsWith('th:'), Priority.LOW)
    const groups = new Map<
      string,
      { assetId: string; level: number; file: Blob; duration: number; idx: number[] }
    >()
    for (const w of wanted.values()) {
      const g = `${w.assetId}:${w.level}`
      let e = groups.get(g)
      if (!e)
        groups.set(
          g,
          (e = { assetId: w.assetId, level: w.level, file: w.file, duration: w.duration, idx: [] }),
        )
      e.idx.push(w.index)
    }
    for (const g of groups.values()) {
      g.idx.sort((a, b) => a - b)
      for (let i = 0; i < g.idx.length; i += 8) {
        const batch = g.idx.slice(i, i + 8)
        const keys = batch.map((k) => `${g.assetId}:${g.level}:${k}`)
        keys.forEach((k) => this.thumbPending.add(k))
        const interval = THUMB_LEVELS[g.level]!
        const times = batch.map((k) =>
          Math.min(Math.max(0, g.duration - 0.05), (k + 0.5) * interval),
        )
        this.scheduler
          .schedule({ key: `th:${keys[0]}`, priority: Priority.HIGH, group: g.assetId }, (signal) =>
            this.worker(g.assetId).thumbnails(g.assetId, g.file, times, THUMB_HEIGHT * 2, {
              signal,
            }),
          )
          .then((bitmaps) => {
            bitmaps.forEach((b, j) => {
              if (b) this.thumbs.set(keys[j]!, b, b.width * b.height * 4)
            })
            this.emit('thumb', { assetId: g.assetId })
          })
          .catch((e) => {
            if (!(e instanceof TaskCancelledError) && !isAbort(e))
              telemetry.error('ANALYSIS_FAILED', String(e))
          })
          .finally(() => keys.forEach((k) => this.thumbPending.delete(k)))
      }
    }
  }

  // ── waveforms ───────────────────────────────────────────────────────────────────────────────

  waveform(assetId: string): Waveform | undefined {
    return this.waveforms.get(assetId)
  }

  /** Start (or restore from cache) the waveform for an asset. Never blocks editing. */
  async ensureWaveform(
    assetId: string,
    cacheKey: string,
    file: Blob,
    durationSec: number,
  ): Promise<void> {
    if (this.waveforms.has(assetId) || this.scheduler.has(`wf:${assetId}`)) return
    this.waveformKeys.set(assetId, cacheKey)
    const cached = await idbGet<{ pps: number; peaks: Int8Array; length: number }>(
      'cache',
      `wf:${cacheKey}`,
    ).catch(() => undefined)
    if (cached) {
      this.waveforms.set(assetId, { ...cached, done: true, mips: new Map() })
      this.emit('waveform', { assetId })
      return
    }
    const capacity = Math.ceil(durationSec * WAVEFORM_PPS + WAVEFORM_PPS) * 2
    this.waveforms.set(assetId, {
      pps: WAVEFORM_PPS,
      peaks: new Int8Array(capacity),
      length: 0,
      done: false,
      mips: new Map(),
    })
    this.scheduler
      .schedule({ key: `wf:${assetId}`, priority: Priority.MEDIUM, group: assetId }, (signal) =>
        this.worker(assetId).waveform(assetId, file, WAVEFORM_PPS, { signal }),
      )
      .then(() => {
        const w = this.waveforms.get(assetId)
        if (w) {
          w.done = true
          const peaks = w.peaks.slice(0, w.length * 2)
          void idbPut('cache', `wf:${cacheKey}`, {
            pps: w.pps,
            peaks,
            length: w.length,
            at: Date.now(),
          }).catch(() => {})
        }
      })
      .catch((e) => {
        this.waveforms.delete(assetId)
        if (!(e instanceof TaskCancelledError) && !isAbort(e))
          telemetry.error('ANALYSIS_FAILED', String(e))
      })
  }

  /** Peaks at a coarser level (factor = peaks merged), built lazily and cached. */
  waveformLevel(w: Waveform, factor: number): { peaks: Int8Array; length: number } {
    if (factor <= 1) return { peaks: w.peaks, length: w.length }
    const len = Math.floor(w.length / factor)
    const m = w.mips.get(factor)
    if (m && m.length === len) return m
    const out = new Int8Array(len * 2)
    for (let i = 0; i < len; i++) {
      let mn = 127
      let mx = -127
      for (let j = i * factor; j < (i + 1) * factor; j++) {
        const a = w.peaks[j * 2]!
        const b = w.peaks[j * 2 + 1]!
        if (a < mn) mn = a
        if (b > mx) mx = b
      }
      out[i * 2] = mn
      out[i * 2 + 1] = mx
    }
    const r = { peaks: out, length: len }
    w.mips.set(factor, r)
    return r
  }

  // ── preview PCM ─────────────────────────────────────────────────────────────────────────────

  pcmChunk(assetId: string, chunk: number): PcmChunk | undefined {
    return this.pcm.get(`${assetId}:${chunk}`)
  }

  /** Decode a chunk of audio for preview playback. */
  loadPcm(
    assetId: string,
    file: Blob,
    chunk: number,
    priority: Priority,
  ): Promise<PcmChunk | null> {
    const key = `${assetId}:${chunk}`
    const hit = this.pcm.peek(key)
    if (hit) return Promise.resolve(hit)
    const pending = this.pcmPending.get(key)
    if (pending) {
      this.scheduler.reprioritize(`pcm:${key}`, priority)
      return pending
    }
    const start = chunk * PCM_CHUNK_SECONDS
    const p = this.scheduler
      .schedule({ key: `pcm:${key}`, priority, group: assetId }, (signal) =>
        this.worker(assetId).pcm(assetId, file, start, start + PCM_CHUNK_SECONDS + 0.05, {
          signal,
        }),
      )
      .then((pcm: Pcm | null) => {
        if (!pcm || !pcm.channels.length || !pcm.channels[0]!.length) return null
        const ctx = this.audioCtx()
        const buf = ctx.createBuffer(pcm.channels.length, pcm.channels[0]!.length, pcm.sampleRate)
        pcm.channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i))
        const entry = { buffer: buf, start: pcm.startSeconds }
        this.pcm.set(key, entry, buf.length * buf.numberOfChannels * 4)
        this.emit('pcm', { assetId, chunk })
        return entry
      })
      .catch(() => null)
      .finally(() => this.pcmPending.delete(key))
    this.pcmPending.set(key, p)
    return p
  }

  // ── proxies ─────────────────────────────────────────────────────────────────────────────────

  buildProxy(assetId: string, file: Blob, path: string, codec: 'avc' | 'vp9'): Promise<number> {
    return this.scheduler.schedule(
      { key: `proxy:${assetId}`, priority: Priority.LOW, group: `proxy:${assetId}` },
      (signal) => this.worker(assetId).buildProxy(assetId, file, path, codec, { signal }),
    )
  }

  cancelProxy(assetId: string): void {
    this.scheduler.cancelGroup(`proxy:${assetId}`)
  }

  decodeBenchmark(assetId: string, file: Blob): Promise<number> {
    return this.scheduler.schedule(
      { key: `bench:${assetId}`, priority: Priority.IDLE, group: assetId },
      (signal) => this.worker(assetId).decodeBenchmark(assetId, file, 2, { signal }),
    )
  }

  /** Forget everything derived from an asset (relink, removal). */
  release(assetId: string): void {
    this.scheduler.cancelGroup(assetId)
    this.thumbs.deleteWhere((k) => k.startsWith(`${assetId}:`))
    this.pcm.deleteWhere((k) => k.startsWith(`${assetId}:`))
    this.waveforms.delete(assetId)
    for (const w of this.workers) void w.release(assetId).catch(() => {})
  }

  /** Memory pressure: drop rebuildable in-memory caches. */
  trim(): void {
    this.thumbs.clear()
    this.pcm.clear()
    for (const w of this.waveforms.values()) w.mips.clear()
  }

  stats() {
    telemetry.thumbCacheBytes = this.thumbs.usedBytes
    telemetry.pcmCacheBytes = this.pcm.usedBytes
    const s = this.scheduler.stats()
    telemetry.backgroundQueue = s.queued
    telemetry.backgroundRunning = s.running
    return { thumbs: this.thumbs.stats(), pcm: this.pcm.stats(), scheduler: s }
  }

  private onWorkerEvent(name: string, payload: unknown): void {
    if (name === 'waveform') {
      const c = payload as WaveformChunk
      const w = this.waveforms.get(c.key)
      if (!w) return
      const need = (c.offset + c.data.length / 2) * 2
      if (need > w.peaks.length) {
        const grown = new Int8Array(Math.max(need, w.peaks.length * 2))
        grown.set(w.peaks)
        w.peaks = grown
      }
      w.peaks.set(c.data, c.offset * 2)
      w.length = Math.max(w.length, c.offset + c.data.length / 2)
      w.mips.clear()
      this.emit('waveform', { assetId: c.key })
    } else if (name === 'proxy') {
      const p = payload as { key: string; progress: number }
      this.emit('proxy', { assetId: p.key, progress: p.progress })
    }
  }
}
