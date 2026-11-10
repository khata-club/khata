/**
 * Turns a frame description into GPU textures: decodes video frames (random access for seeks and
 * scrubs, sequential readers for playback/export), images and text. Shared by the preview render
 * worker and the export worker.
 *
 * Memory is bounded: decoded frames are uploaded and closed immediately (so hardware decoder pools
 * never starve), and textures live in a byte-budgeted LRU that deletes on eviction.
 */
import {
  type Asset,
  type FrameDescription,
  LruCache,
  type RenderLayer,
  type TextProps,
  ticksToSeconds,
} from '@khata/kaat-core'
import { type InputVideoTrack, type VideoSample, VideoSampleSink } from 'mediabunny'

import { InputPool, sameBlob } from '../media/inputs'
import type { Compositor, LayerTexture } from './compositor'
import { rasterizeText, textCacheKey, textRasterScale } from './text'

interface CachedTex {
  tex: LayerTexture
  assetKey: string
  start: number
  end: number
}

/** Sequential reader over one clip's source: decodes forward, the way playback and export read. */
class SequentialReader {
  private it?: AsyncGenerator<VideoSample, void, unknown>
  private next?: VideoSample | null
  private curStart = -1
  private curEnd = -1
  lastUsed = 0

  constructor(private readonly sink: VideoSampleSink) {}

  /** Returns a sample covering `t` (caller must not close it), or null past the end. */
  async frameAt(t: number): Promise<VideoSample | null> {
    if (!this.it || t < this.curStart - 1e-6 || t > this.curEnd + 2) await this.restart(t)
    let picked: VideoSample | null = null
    // Advance while the next sample starts at or before t.
    while (this.next && this.next.timestamp <= t + 1e-6) {
      picked?.close()
      picked = this.next
      this.curStart = picked.timestamp
      this.curEnd = picked.timestamp + (picked.duration || 1 / 30)
      const r = await this.it!.next()
      this.next = r.done ? null : r.value
    }
    return picked
  }

  private async restart(t: number): Promise<void> {
    await this.close()
    this.it = this.sink.samples(t)
    const r = await this.it.next()
    this.next = r.done ? null : r.value
    this.curStart = t
    this.curEnd = t
    // The first sample may start slightly after t (keyframe rounding); accept it.
    if (this.next && this.next.timestamp > t) this.curStart = this.next.timestamp
  }

  get position(): [number, number] {
    return [this.curStart, this.curEnd]
  }

  async close(): Promise<void> {
    this.next?.close()
    this.next = undefined
    if (this.it) await this.it.return(undefined).catch(() => {})
    this.it = undefined
  }
}

export interface ProviderOptions {
  /** VRAM budget for cached textures. */
  textureBudget: number
  /** Use proxies when available (preview only). */
  useProxies: boolean
}

export interface PrepareStats {
  decodeMs: number
  cacheHits: number
  cacheMisses: number
  missing: string[]
}

export class FrameProvider {
  private pool = new InputPool(10)
  private files = new Map<string, { original?: Blob; proxy?: Blob }>()
  private sinks = new Map<string, { sink: VideoSampleSink; track: InputVideoTrack }>()
  private readers = new Map<string, SequentialReader>()
  private texCache: LruCache<string, CachedTex>
  private byAsset = new Map<string, Set<string>>()
  private images = new Map<string, Promise<ImageBitmap | null>>()
  private fontsReady: Promise<void> = Promise.resolve()
  private clock = 0
  maxTextureWidth = Number.POSITIVE_INFINITY
  maxTextureHeight = Number.POSITIVE_INFINITY
  rasterScale = 1

  constructor(
    private readonly compositor: Compositor,
    private opts: ProviderOptions,
  ) {
    this.texCache = new LruCache<string, CachedTex>(opts.textureBudget, (key, v) => {
      this.compositor.deleteTexture(v.tex)
      this.byAsset.get(v.assetKey)?.delete(key)
    })
  }

  setFonts(p: Promise<void>): void {
    this.fontsReady = p
  }

  setFile(assetId: string, original: Blob | undefined, proxy?: Blob): void {
    const prev = this.files.get(assetId)
    const same = (x?: Blob, y?: Blob) => (!x && !y) || (!!x && !!y && sameBlob(x, y))
    if (prev && same(prev.original, original) && same(prev.proxy, proxy)) return
    this.files.set(assetId, { original, proxy })
    this.dropAsset(assetId)
  }

  /** Original source blobs by asset id. */
  originals(): [string, Blob][] {
    const out: [string, Blob][] = []
    for (const [id, f] of this.files) if (f.original) out.push([id, f.original])
    return out
  }

  removeFile(assetId: string): void {
    this.files.delete(assetId)
    this.dropAsset(assetId)
  }

  setBudget(bytes: number): void {
    this.texCache.setBudget(bytes)
  }

  stats() {
    return {
      texture: this.texCache.stats(),
      hitRate: this.texCache.hitRate(),
      readers: this.readers.size,
      inputs: this.pool.size,
    }
  }

  /** Drop all cached textures (memory pressure, quality change). */
  trim(): void {
    this.texCache.clear()
  }

  /** Close sequential readers not used in the last `idleFrames` frames. */
  async releaseIdleReaders(idleFrames = 30): Promise<void> {
    for (const [k, r] of this.readers)
      if (this.clock - r.lastUsed > idleFrames) {
        this.readers.delete(k)
        await r.close()
      }
  }

  async closeReaders(): Promise<void> {
    const all = [...this.readers.values()]
    this.readers.clear()
    await Promise.all(all.map((r) => r.close()))
  }

  /**
   * Make sure every layer of `frame` has a texture. `sequential` uses per-clip forward readers
   * (playback, export); otherwise random access (seek, scrub, still).
   */
  async prepare(
    frame: FrameDescription,
    assets: Record<string, Asset>,
    sequential: boolean,
  ): Promise<{ textures: Map<string, LayerTexture>; stats: PrepareStats }> {
    this.clock++
    const t0 = performance.now()
    const textures = new Map<string, LayerTexture>()
    const stats: PrepareStats = { decodeMs: 0, cacheHits: 0, cacheMisses: 0, missing: [] }
    await Promise.all(
      frame.layers.map(async (layer) => {
        if (layer.kind === 'solid') return
        try {
          const tex = await this.textureFor(layer, assets, sequential, stats)
          if (tex) textures.set(layer.key, tex)
          else stats.missing.push(layer.key)
        } catch (e) {
          stats.missing.push(layer.key)
          throw e
        }
      }),
    )
    stats.decodeMs = performance.now() - t0
    return { textures, stats }
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────────

  private source(assetId: string): { blob: Blob; variant: string } | undefined {
    const f = this.files.get(assetId)
    if (!f) return undefined
    if (this.opts.useProxies && f.proxy) return { blob: f.proxy, variant: 'proxy' }
    if (f.original) return { blob: f.original, variant: 'orig' }
    return undefined
  }

  private dropAsset(assetId: string): void {
    for (const variant of ['orig', 'proxy']) {
      const key = `${assetId}:${variant}`
      this.pool.close(key)
      this.sinks.delete(key)
      const keys = this.byAsset.get(key)
      if (keys) for (const k of [...keys]) this.texCache.delete(k)
      this.byAsset.delete(key)
    }
    this.texCache.delete(`img:${assetId}`)
    this.images.delete(assetId)
    for (const [k, r] of this.readers)
      if (k.startsWith(`${assetId}|`)) {
        this.readers.delete(k)
        void r.close()
      }
  }

  private async textureFor(
    layer: RenderLayer,
    assets: Record<string, Asset>,
    sequential: boolean,
    stats: PrepareStats,
  ): Promise<LayerTexture | undefined> {
    if (layer.kind === 'text') return this.textTexture(layer)
    if (!layer.assetId) return undefined
    const asset = assets[layer.assetId]
    if (!asset) return undefined
    if (layer.kind === 'image') return this.imageTexture(asset, stats)
    return this.videoTexture(layer, asset, sequential, stats)
  }

  private async textTexture(layer: RenderLayer): Promise<LayerTexture | undefined> {
    const text = layer.text as TextProps
    const rs = textRasterScale(this.rasterScale * layer.transform.scale)
    const key = textCacheKey(text, rs)
    const hit = this.texCache.get(key)
    if (hit) return hit.tex
    await this.fontsReady
    const r = rasterizeText(text, rs)
    const tex = this.compositor.upload(r.canvas, r.width, r.height)
    // Natural size in project pixels.
    tex.width = r.width / rs
    tex.height = r.height / rs
    this.texCache.set(key, { tex, assetKey: 'text', start: 0, end: 0 }, r.width * r.height * 4)
    return tex
  }

  private async imageTexture(asset: Asset, stats: PrepareStats): Promise<LayerTexture | undefined> {
    const key = `img:${asset.id}`
    const hit = this.texCache.get(key)
    if (hit) {
      stats.cacheHits++
      return hit.tex
    }
    stats.cacheMisses++
    const f = this.files.get(asset.id)?.original
    if (!f) return undefined
    let p = this.images.get(asset.id)
    if (!p) {
      p = createImageBitmap(f).catch(() => null)
      this.images.set(asset.id, p)
    }
    const bmp = await p
    this.images.delete(asset.id)
    if (!bmp) return undefined
    const tex = this.compositor.upload(bmp, bmp.width, bmp.height, {
      maxWidth: this.maxTextureWidth,
      maxHeight: this.maxTextureHeight,
    })
    bmp.close()
    this.texCache.set(
      key,
      { tex, assetKey: `img:${asset.id}`, start: 0, end: 0 },
      tex.width * tex.height * 4,
    )
    return tex
  }

  private sinkFor(
    assetKey: string,
    blob: Blob,
  ): Promise<{ sink: VideoSampleSink; track: InputVideoTrack } | undefined> {
    const s = this.sinks.get(assetKey)
    if (s) return Promise.resolve(s)
    return (async () => {
      const { input } = this.pool.get(assetKey, blob)
      const track = await input.getPrimaryVideoTrack()
      if (!track) return undefined
      const entry = { sink: new VideoSampleSink(track), track }
      this.sinks.set(assetKey, entry)
      return entry
    })()
  }

  private lookup(assetKey: string, t: number): CachedTex | undefined {
    const keys = this.byAsset.get(assetKey)
    if (!keys) return undefined
    for (const k of keys) {
      const e = this.texCache.peek(k)
      if (e && t >= e.start - 1e-6 && t < e.end - 1e-6) return this.texCache.get(k)
    }
    return undefined
  }

  private store(
    assetKey: string,
    sample: VideoSample,
    displayW: number,
    displayH: number,
  ): CachedTex {
    const frame = sample.toVideoFrame()
    let tex: LayerTexture
    try {
      tex = this.compositor.upload(frame, displayW, displayH, {
        maxWidth: this.maxTextureWidth,
        maxHeight: this.maxTextureHeight,
        rotation: sample.rotation,
      })
    } finally {
      frame.close()
    }
    const start = sample.timestamp
    const end = sample.timestamp + (sample.duration || 1 / 30)
    const key = `${assetKey}@${Math.round(start * 1e6)}`
    const entry: CachedTex = { tex, assetKey, start, end }
    let set = this.byAsset.get(assetKey)
    if (!set) this.byAsset.set(assetKey, (set = new Set()))
    set.add(key)
    this.texCache.set(key, entry, tex.width * tex.height * 4)
    return entry
  }

  private async videoTexture(
    layer: RenderLayer,
    asset: Asset,
    sequential: boolean,
    stats: PrepareStats,
  ): Promise<LayerTexture | undefined> {
    const src = this.source(asset.id)
    if (!src) return undefined
    const assetKey = `${asset.id}:${src.variant}`
    const t = ticksToSeconds(layer.sourceTime + (asset.startTime ?? 0))
    const hit = this.lookup(assetKey, t)
    if (hit) {
      stats.cacheHits++
      return hit.tex
    }
    stats.cacheMisses++
    const s = await this.sinkFor(assetKey, src.blob)
    if (!s) return undefined
    const dw = asset.width || s.track.displayWidth
    const dh = asset.height || s.track.displayHeight
    if (sequential) {
      const rk = `${asset.id}|${src.variant}|${layer.key}`
      let reader = this.readers.get(rk)
      if (!reader) this.readers.set(rk, (reader = new SequentialReader(s.sink)))
      reader.lastUsed = this.clock
      const sample = await reader.frameAt(t)
      if (!sample) {
        // Past the end: fall back to random access (hold last frame).
        return this.randomFrame(assetKey, s.sink, t, dw, dh)
      }
      const entry = this.store(assetKey, sample, dw, dh)
      sample.close()
      return entry.tex
    }
    return this.randomFrame(assetKey, s.sink, t, dw, dh)
  }

  private async randomFrame(
    assetKey: string,
    sink: VideoSampleSink,
    t: number,
    dw: number,
    dh: number,
  ): Promise<LayerTexture | undefined> {
    const sample = await sink.getSample(t)
    if (!sample) return undefined
    try {
      return this.store(assetKey, sample, dw, dh).tex
    } finally {
      sample.close()
    }
  }
}
