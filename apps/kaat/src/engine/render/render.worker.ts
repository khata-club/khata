/**
 * Preview render worker. Owns the preview OffscreenCanvas, the WebGL compositor and the decoders,
 * so decoded frames never cross threads and heavy work never touches the interaction thread.
 *
 * Requests are processed one at a time; the main thread only ever sends the latest wanted frame
 * (latest-wins), so rapid seeking can't build up a backlog.
 */
import { type Project, resolveFrame } from '@khata/kaat-core'

import { type Handlers, expose, transfer } from '../rpc'
import { Compositor } from './compositor'
import { FrameProvider } from './frameProvider'
import type { RenderApi, RenderResult } from './protocol'
import { type FontSource, loadFonts } from './text'

let compositor: Compositor | undefined
let provider: FrameProvider | undefined
let project: Project | undefined
let fontsReady: Promise<void> = Promise.resolve()

function ensure(): { compositor: Compositor; provider: FrameProvider } {
  if (!compositor || !provider) throw new Error('Render worker not initialised')
  return { compositor, provider }
}

const handlers: Handlers<RenderApi> = {
  async init(canvas: OffscreenCanvas, fonts: FontSource[], textureBudget: number) {
    compositor = new Compositor(canvas)
    provider = new FrameProvider(compositor, { textureBudget, useProxies: true })
    fontsReady = loadFonts(fonts)
    provider.setFonts(fontsReady)
    return true
  },

  async setProject(p: Project) {
    project = p
  },

  async setSource(assetId: string, original: Blob | null, proxy: Blob | null) {
    ensure().provider.setFile(assetId, original ?? undefined, proxy ?? undefined)
  },

  async removeSource(assetId: string) {
    ensure().provider.removeFile(assetId)
  },

  async render(
    t: number,
    mode: 'still' | 'scrub' | 'play',
    scale: number,
    cssW: number,
    cssH: number,
  ) {
    const { compositor, provider } = ensure()
    if (!project) return { renderMs: 0, decodeMs: 0, missing: [], layers: 0, width: 0, height: 0 }
    const t0 = performance.now()
    const { width, height } = project.settings
    // Canvas pixels: the smaller of the on-screen size and the project size, times quality scale.
    const fit = Math.min(1, cssW / width, cssH / height)
    const k = Math.max(0.05, fit * scale)
    const cw = Math.max(2, Math.round(width * k))
    const ch = Math.max(2, Math.round(height * k))
    compositor.resize(cw, ch)
    provider.maxTextureWidth = cw
    provider.maxTextureHeight = ch
    provider.rasterScale = k
    const frame = resolveFrame(project, t)
    const { textures, stats } = await provider.prepare(frame, project.assets, mode === 'play')
    const drawn = compositor.render(frame, (l) => textures.get(l.key), k)
    if (mode !== 'play') void provider.releaseIdleReaders(4)
    const result: RenderResult = {
      renderMs: performance.now() - t0,
      decodeMs: stats.decodeMs,
      missing: [...stats.missing, ...drawn.missing],
      layers: drawn.drawn,
      width: cw,
      height: ch,
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
    }
    return result
  },

  async stopPlayback() {
    await ensure().provider.closeReaders()
  },

  async stats() {
    const s = ensure().provider.stats()
    return {
      textureBytes: s.texture.bytes,
      textureBudget: s.texture.budget,
      textures: s.texture.entries,
      hitRate: s.hitRate,
      readers: s.readers,
      inputs: s.inputs,
    }
  },

  async setBudget(bytes: number) {
    ensure().provider.setBudget(bytes)
  },

  async trim() {
    const { provider } = ensure()
    provider.trim()
    await provider.closeReaders()
  },

  /** PNG of the current frame at `t`, rendered at full project size (tests, poster frames). */
  async capture(t: number) {
    const { provider } = ensure()
    if (!project) return null
    const { width, height } = project.settings
    const canvas = new OffscreenCanvas(width, height)
    const c = new Compositor(canvas, { preserveDrawingBuffer: true })
    const local = new FrameProvider(c, { textureBudget: 256 * 1024 * 1024, useProxies: false })
    local.setFonts(fontsReady)
    try {
      for (const [id, blob] of provider.originals()) local.setFile(id, blob)
      local.rasterScale = 1
      const frame = resolveFrame(project, t)
      const { textures } = await local.prepare(frame, project.assets, false)
      c.render(frame, (l) => textures.get(l.key), 1)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      return transfer(await blob.arrayBuffer(), [])
    } finally {
      await local.closeReaders()
      local.trim()
      c.dispose()
    }
  },
}

expose<RenderApi>(self as unknown as DedicatedWorkerGlobalScope, handlers)
