/**
 * Canvas timeline. Plain TypeScript (no Vue reactivity in the hot path):
 *
 * - Drawing is virtualised: each track finds its visible clips by binary search, so cost tracks
 *   the viewport, not the project (1,000+ clips stay smooth).
 * - Two canvases: `base` (ruler, lanes, clips) redraws only when invalidated; `overlay` (playhead,
 *   guides) redraws on every playhead move without touching clips.
 * - Drags keep a ghost outside the project; one command is dispatched on pointerup.
 * - Thumbnails and waveforms are drawn from bounded caches at a zoom-appropriate level of detail;
 *   anything missing is requested at high priority and drawn when it arrives.
 */
import {
  type Clip,
  type Project,
  SnapIndex,
  type SnapPoint,
  TICKS_PER_SECOND,
  type Ticks,
  type Track,
  activeSequence,
  clipEnd,
  clipsInRange,
  dbToGain,
  floorToFrame,
  keyframeTimes,
  minClipDuration,
  roundToFrame,
  sequenceDuration,
  ticksPerFrame,
  trimLimits,
} from '@khata/kaat-core'

import type { Editor } from '../../engine/editor'
import { MediaService } from '../../engine/media/mediaService'
import { telemetry } from '../../engine/telemetry'

export const RULER_H = 28
export const VIDEO_H = 64
export const AUDIO_H = 52
const EDGE_PX = 6
const SNAP_PX = 8
const MIN_PPS = 0.01
const MAX_PPS = 3000

export interface Row {
  track: Track
  y: number
  h: number
}

type Drag =
  | { kind: 'scrub' }
  | { kind: 'pending'; clip: Clip; row: Row; x0: number; y0: number; additive: boolean }
  | {
      kind: 'move'
      clip: Clip
      row: Row
      x0: number
      y0: number
      ids: Set<string>
      delta: Ticks
      trackOffset: number
      snap: SnapIndex
      guide?: SnapPoint
    }
  | {
      kind: 'trim'
      clip: Clip
      row: Row
      edge: 'start' | 'end'
      x0: number
      delta: Ticks
      min: Ticks
      max: Ticks
      snap: SnapIndex
      guide?: SnapPoint
    }

export interface DropHint {
  t: Ticks
  row?: Row
  duration: Ticks
}

const COLORS = {
  bg: '#f4f6fa',
  laneA: '#ffffff',
  laneB: '#fafbfd',
  line: '#e8ecf3',
  ruler: '#fafbfd',
  rulerText: '#52617d',
  tick: '#c3ccda',
  video: '#2f62e0',
  videoFill: '#dce6ff',
  image: '#1a8a7a',
  imageFill: '#d5f0ea',
  audio: '#137744',
  audioFill: '#d9f1e3',
  text: '#7b4bd1',
  textFill: '#ebe1fb',
  offline: '#c42b37',
  offlineFill: '#fbe3e5',
  selection: '#0f1b2d',
  playhead: '#c42b37',
  inout: 'rgba(36,87,214,0.10)',
  snap: '#E0A100',
  marker: '#E0A100',
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export class TimelineView {
  pps = 60
  /** Left edge, in seconds. */
  scrollX = 0
  scrollY = 0
  width = 800
  height = 300
  private dpr = 1
  private baseCtx: CanvasRenderingContext2D
  private overlayCtx: CanvasRenderingContext2D
  private rafBase = 0
  private rafOverlay = 0
  private drag?: Drag
  dropHint?: DropHint
  private unsub: (() => void)[] = []
  onViewChange?: () => void
  onRows?: (rows: Row[], scrollY: number) => void

  constructor(
    private readonly editor: Editor,
    private readonly base: HTMLCanvasElement,
    private readonly overlay: HTMLCanvasElement,
  ) {
    this.baseCtx = base.getContext('2d', { alpha: false })!
    this.overlayCtx = overlay.getContext('2d')!
    this.pps = editor.ui.pxPerSecond
    this.unsub.push(
      editor.store.subscribe(() => this.invalidate()),
      editor.media.on('thumb', () => this.invalidate()),
      editor.media.on('waveform', () => this.invalidate()),
      editor.transport.on('time', (t) => this.onTime(t)),
    )
    overlay.addEventListener('pointerdown', this.onDown)
    overlay.addEventListener('pointermove', this.onMove)
    overlay.addEventListener('pointerup', this.onUp)
    overlay.addEventListener('pointercancel', this.onUp)
    overlay.addEventListener('wheel', this.onWheel, { passive: false })
    overlay.addEventListener('dblclick', this.onDblClick)
  }

  destroy(): void {
    this.unsub.forEach((u) => u())
    cancelAnimationFrame(this.rafBase)
    cancelAnimationFrame(this.rafOverlay)
    this.overlay.removeEventListener('pointerdown', this.onDown)
    this.overlay.removeEventListener('pointermove', this.onMove)
    this.overlay.removeEventListener('pointerup', this.onUp)
    this.overlay.removeEventListener('pointercancel', this.onUp)
    this.overlay.removeEventListener('wheel', this.onWheel)
    this.overlay.removeEventListener('dblclick', this.onDblClick)
  }

  get project(): Project {
    return this.editor.store.project
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = w
    this.height = h
    for (const c of [this.base, this.overlay]) {
      c.width = Math.round(w * this.dpr)
      c.height = Math.round(h * this.dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
    }
    this.invalidate()
  }

  // ── geometry ────────────────────────────────────────────────────────────────────────────────

  xOf(t: Ticks): number {
    return (t / TICKS_PER_SECOND - this.scrollX) * this.pps
  }

  tOf(x: number): Ticks {
    return (x / this.pps + this.scrollX) * TICKS_PER_SECOND
  }

  rows(): Row[] {
    const seq = activeSequence(this.project)
    const videos = seq.tracks.filter((t) => t.kind === 'video').reverse()
    const audios = seq.tracks.filter((t) => t.kind === 'audio')
    const out: Row[] = []
    let y = RULER_H - this.scrollY
    for (const t of videos) {
      out.push({ track: t, y, h: VIDEO_H })
      y += VIDEO_H
    }
    y += 6 // gap between video and audio groups
    for (const t of audios) {
      out.push({ track: t, y, h: AUDIO_H })
      y += AUDIO_H
    }
    return out
  }

  contentHeight(): number {
    const seq = activeSequence(this.project)
    return seq.tracks.reduce((n, t) => n + (t.kind === 'video' ? VIDEO_H : AUDIO_H), RULER_H + 6)
  }

  rowAt(y: number): Row | undefined {
    return this.rows().find((r) => y >= r.y && y < r.y + r.h)
  }

  setZoom(pps: number, anchorX = this.width / 2): void {
    const t = this.scrollX + anchorX / this.pps
    this.pps = Math.max(MIN_PPS, Math.min(MAX_PPS, pps))
    this.scrollX = Math.max(0, t - anchorX / this.pps)
    this.editor.ui.pxPerSecond = this.pps
    this.invalidate()
    this.onViewChange?.()
  }

  zoomToFit(): void {
    const d = sequenceDuration(activeSequence(this.project)) / TICKS_PER_SECOND
    if (d <= 0) return
    this.pps = Math.max(MIN_PPS, Math.min(MAX_PPS, (this.width - 40) / d))
    this.scrollX = 0
    this.editor.ui.pxPerSecond = this.pps
    this.invalidate()
    this.onViewChange?.()
  }

  scrollTo(sec: number): void {
    this.scrollX = Math.max(0, sec)
    this.invalidate()
    this.onViewChange?.()
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────

  invalidate(): void {
    if (this.rafBase) return
    this.rafBase = requestAnimationFrame(() => {
      this.rafBase = 0
      this.drawBase()
      this.drawOverlay()
    })
  }

  private onTime(t: Ticks): void {
    // Keep the playhead in view while playing.
    if (this.editor.ui.playing || this.editor.transport.playing) {
      const x = this.xOf(t)
      if (x > this.width - 20 || x < 0) this.scrollTo(t / TICKS_PER_SECOND - 20 / this.pps)
    }
    if (this.rafOverlay) return
    this.rafOverlay = requestAnimationFrame(() => {
      this.rafOverlay = 0
      this.drawOverlay()
    })
  }

  private drawBase(): void {
    const t0 = performance.now()
    const ctx = this.baseCtx
    const { width: W, height: H } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)
    const p = this.project
    const seq = activeSequence(p)
    const fromT = this.tOf(0)
    const toT = this.tOf(W)
    const rows = this.rows()
    this.onRows?.(rows, this.scrollY)

    // Lanes and clips (below the ruler).
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, RULER_H, W, H - RULER_H)
    ctx.clip()
    rows.forEach((r, i) => {
      if (r.y > H || r.y + r.h < RULER_H) return
      ctx.fillStyle = i % 2 ? COLORS.laneB : COLORS.laneA
      ctx.fillRect(0, r.y, W, r.h)
      ctx.fillStyle = COLORS.line
      ctx.fillRect(0, r.y + r.h - 1, W, 1)
      if (r.track.locked) {
        ctx.fillStyle = 'rgba(15,27,45,0.04)'
        ctx.fillRect(0, r.y, W, r.h - 1)
      }
      const drag = this.drag
      const moving = drag?.kind === 'move' ? drag.ids : undefined
      for (const c of clipsInRange(r.track.clips, fromT, toT)) {
        if (moving?.has(c.id)) {
          this.drawClip(ctx, c, r, { dim: true })
          continue
        }
        if (drag?.kind === 'trim' && drag.clip.id === c.id) {
          const ghost =
            drag.edge === 'start'
              ? { ...c, start: c.start + drag.delta, duration: c.duration - drag.delta }
              : { ...c, duration: c.duration + drag.delta }
          this.drawClip(ctx, ghost, r, { ghost: true })
          continue
        }
        this.drawClip(ctx, c, r)
      }
    })
    // Move ghosts.
    if (this.drag?.kind === 'move') this.drawMoveGhosts(ctx, rows, this.drag)
    // Drop target from the media panel.
    if (this.dropHint) {
      const h = this.dropHint
      const x = this.xOf(h.t)
      const w = (h.duration / TICKS_PER_SECOND) * this.pps
      if (h.row) {
        ctx.fillStyle = 'rgba(36,87,214,0.18)'
        ctx.strokeStyle = COLORS.video
        ctx.lineWidth = 1.5
        roundRect(ctx, x, h.row.y + 3, Math.max(4, w), h.row.h - 7, 6)
        ctx.fill()
        ctx.stroke()
      }
    }
    ctx.restore()

    this.drawRuler(ctx, seq, fromT, toT)
    telemetry.timelineDrawMs.push(performance.now() - t0)
  }

  private drawRuler(
    ctx: CanvasRenderingContext2D,
    seq: ReturnType<typeof activeSequence>,
    fromT: Ticks,
    toT: Ticks,
  ): void {
    const W = this.width
    ctx.fillStyle = COLORS.ruler
    ctx.fillRect(0, 0, W, RULER_H)
    ctx.fillStyle = COLORS.line
    ctx.fillRect(0, RULER_H - 1, W, 1)
    // In/out range.
    if (seq.inPoint !== undefined || seq.outPoint !== undefined) {
      const a = this.xOf(seq.inPoint ?? 0)
      const b = seq.outPoint !== undefined ? this.xOf(seq.outPoint) : W
      ctx.fillStyle = COLORS.inout
      ctx.fillRect(a, 0, b - a, this.height)
      ctx.fillStyle = COLORS.video
      if (seq.inPoint !== undefined) ctx.fillRect(a, 0, 2, RULER_H)
      if (seq.outPoint !== undefined) ctx.fillRect(b - 2, 0, 2, RULER_H)
    }
    // Ticks: pick a step ≥ 70 px.
    const fps = this.project.settings.fps
    const frameSec = ticksPerFrame(fps) / TICKS_PER_SECOND
    const steps = [
      frameSec,
      frameSec * 5,
      frameSec * 10,
      1,
      2,
      5,
      10,
      15,
      30,
      60,
      120,
      300,
      600,
      900,
      1800,
      3600,
    ]
    const step = steps.find((s) => s * this.pps >= 70) ?? 3600
    const sub = step >= 1 ? step / 5 : step
    ctx.font = '500 10px "Geist Mono", ui-monospace, monospace'
    ctx.textBaseline = 'top'
    const s0 = Math.floor(fromT / TICKS_PER_SECOND / sub) * sub
    for (let s = s0; s <= toT / TICKS_PER_SECOND + sub; s += sub) {
      const x = Math.round((s - this.scrollX) * this.pps) + 0.5
      const major = Math.abs(s / step - Math.round(s / step)) < 1e-6
      ctx.fillStyle = COLORS.tick
      ctx.fillRect(x, major ? 14 : 20, 1, major ? RULER_H - 14 : RULER_H - 20)
      if (major) {
        ctx.fillStyle = COLORS.rulerText
        ctx.fillText(this.label(s, step < 1), x + 3, 3)
      }
    }
    // Markers.
    for (const m of seq.markers) {
      const x = this.xOf(m.t)
      if (x < -10 || x > W + 10) continue
      ctx.fillStyle = m.color || COLORS.marker
      ctx.beginPath()
      ctx.moveTo(x - 5, RULER_H - 12)
      ctx.lineTo(x + 5, RULER_H - 12)
      ctx.lineTo(x, RULER_H - 4)
      ctx.closePath()
      ctx.fill()
    }
  }

  private label(sec: number, frames: boolean): string {
    const fps = this.project.settings.fps
    const nominal = Math.round(fps.num / fps.den)
    const whole = Math.floor(sec + 1e-6)
    const h = Math.floor(whole / 3600)
    const m = Math.floor(whole / 60) % 60
    const s = whole % 60
    const base = h
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
    if (!frames) return base
    return `${base}:${String(Math.round((sec - whole) * nominal)).padStart(2, '0')}`
  }

  private clipColors(c: Clip): { stroke: string; fill: string } {
    if (c.kind === 'text') return { stroke: COLORS.text, fill: COLORS.textFill }
    const a = c.assetId ? this.project.assets[c.assetId] : undefined
    if (!a || a.status === 'missing' || a.status === 'error' || !this.editor.sources.get(a.id))
      return { stroke: COLORS.offline, fill: COLORS.offlineFill }
    if (a.kind === 'audio') return { stroke: COLORS.audio, fill: COLORS.audioFill }
    if (a.kind === 'image') return { stroke: COLORS.image, fill: COLORS.imageFill }
    return { stroke: COLORS.video, fill: COLORS.videoFill }
  }

  private drawClip(
    ctx: CanvasRenderingContext2D,
    c: Clip,
    r: Row,
    opts: { dim?: boolean; ghost?: boolean; kind?: 'video' | 'audio' } = {},
  ): void {
    const x = this.xOf(c.start)
    const w = Math.max(2, (c.duration / TICKS_PER_SECOND) * this.pps)
    const y = r.y + 2
    const h = r.h - 5
    const visX = Math.max(x, -4)
    const visW = Math.min(x + w, this.width + 4) - visX
    if (visW <= 0) return
    const isAudioLane = (opts.kind ?? r.track.kind) === 'audio'
    // Level of detail: clips a few pixels wide (zoomed far out) are a plain bar.
    if (w < 6 && !opts.ghost) {
      ctx.globalAlpha = opts.dim ? 0.35 : 1
      ctx.fillStyle = isAudioLane ? COLORS.audio : c.kind === 'text' ? COLORS.text : COLORS.video
      ctx.fillRect(x, y, Math.max(1, w - 0.5), h)
      ctx.globalAlpha = 1
      return
    }
    const a = c.assetId ? this.project.assets[c.assetId] : undefined
    const online = !!a && !!this.editor.sources.get(a.id) && a.status === 'ready'
    let { stroke, fill } = this.clipColors(c)
    if (isAudioLane && online) {
      stroke = COLORS.audio
      fill = COLORS.audioFill
    }
    ctx.globalAlpha = opts.dim ? 0.35 : 1
    roundRect(ctx, x, y, w, h, 6)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.save()
    roundRect(ctx, x, y, w, h, 6)
    ctx.clip()

    // Content: thumbnails / waveform / text.
    if (online && w > 8) {
      if (isAudioLane) this.drawWaveform(ctx, c, x, y + 14, w, h - 14)
      else if (a!.kind === 'video' || a!.kind === 'image')
        this.drawThumbs(ctx, c, x, y + 16, w, h - 16)
    }
    if (!online && c.kind === 'media') {
      // Offline hatch.
      ctx.strokeStyle = 'rgba(196,43,55,0.25)'
      ctx.lineWidth = 1
      for (let k = Math.floor(visX / 8) * 8 - h; k < visX + visW; k += 8) {
        ctx.beginPath()
        ctx.moveTo(k, y + h)
        ctx.lineTo(k + h, y)
        ctx.stroke()
      }
    }
    // Title bar.
    ctx.fillStyle = stroke
    ctx.globalAlpha = (opts.dim ? 0.35 : 1) * 0.9
    ctx.fillRect(x, y, w, 15)
    ctx.globalAlpha = opts.dim ? 0.35 : 1
    if (w > 24) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 10.5px Quicksand, system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      const label =
        c.kind === 'text'
          ? `T  ${c.text?.content.split('\n')[0] ?? ''}`
          : (online ? '' : '⚠ ') + c.name
      ctx.fillText(label, Math.max(x, 0) + 6, y + 8, Math.max(10, visW - 12))
    }
    if (c.kind === 'text' && h > 30 && w > 30) {
      ctx.fillStyle = COLORS.text
      ctx.font = '600 12px Quicksand, system-ui, sans-serif'
      ctx.fillText(
        c.text?.content.split('\n')[0] ?? '',
        Math.max(x, 0) + 6,
        y + 30,
        Math.max(10, visW - 12),
      )
    }
    // Audio fades.
    if (isAudioLane && (c.audio.fadeIn || c.audio.fadeOut)) {
      ctx.fillStyle = 'rgba(15,27,45,0.18)'
      if (c.audio.fadeIn) {
        const fw = (c.audio.fadeIn / TICKS_PER_SECOND) * this.pps
        ctx.beginPath()
        ctx.moveTo(x, y + 15)
        ctx.lineTo(x + fw, y + 15)
        ctx.lineTo(x, y + h)
        ctx.closePath()
        ctx.fill()
      }
      if (c.audio.fadeOut) {
        const fw = (c.audio.fadeOut / TICKS_PER_SECOND) * this.pps
        ctx.beginPath()
        ctx.moveTo(x + w, y + 15)
        ctx.lineTo(x + w - fw, y + 15)
        ctx.lineTo(x + w, y + h)
        ctx.closePath()
        ctx.fill()
      }
    }
    // Transition at head.
    if (c.transitionIn && !isAudioLane) {
      const tw = (c.transitionIn.duration / TICKS_PER_SECOND) * this.pps
      ctx.fillStyle = 'rgba(15,27,45,0.22)'
      ctx.beginPath()
      ctx.moveTo(x, y + h)
      ctx.lineTo(x + tw, y + 15)
      ctx.lineTo(x, y + 15)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    const selected = this.editor.ui.selection.includes(c.id)
    // Keyframe diamonds.
    if (selected && !isAudioLane) {
      ctx.fillStyle = '#E0A100'
      for (const kt of keyframeTimes(c)) {
        if (kt < 0 || kt > c.duration) continue
        const kx = x + (kt / TICKS_PER_SECOND) * this.pps
        ctx.beginPath()
        ctx.moveTo(kx, y + h - 9)
        ctx.lineTo(kx + 4, y + h - 5)
        ctx.lineTo(kx, y + h - 1)
        ctx.lineTo(kx - 4, y + h - 5)
        ctx.closePath()
        ctx.fill()
      }
    }
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6)
    ctx.strokeStyle = selected ? COLORS.selection : opts.ghost ? COLORS.snap : stroke
    ctx.lineWidth = selected || opts.ghost ? 2 : 1
    ctx.stroke()
    if (c.linkId && w > 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '600 9px Quicksand, sans-serif'
      ctx.fillText('🔗', Math.min(x + w, this.width) - 16, y + 8)
    }
    ctx.globalAlpha = 1
  }

  private drawThumbs(
    ctx: CanvasRenderingContext2D,
    c: Clip,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const a = this.project.assets[c.assetId!]!
    const file = this.editor.sources.get(a.id)
    const aspect = a.width && a.height ? a.width / a.height : 16 / 9
    const tw = Math.max(16, h * aspect)
    if (a.kind === 'image') {
      const bmp = this.editor.media.thumb(a.id, file, 0, 0, 0)
      if (bmp)
        for (let k = Math.max(x, -tw); k < Math.min(x + w, this.width); k += tw)
          ctx.drawImage(bmp, k, y, tw, h)
      return
    }
    const level = MediaService.thumbLevel(this.pps, tw)
    const interval = MediaService.levelSeconds(level)
    const durSec = a.duration / TICKS_PER_SECOND
    const srcIn = c.sourceIn / TICKS_PER_SECOND
    // Tiles aligned to a fixed source-time grid so scrolling doesn't shimmer.
    const tileSec = tw / this.pps
    const visStartSec = Math.max(0, -x / this.pps) // seconds into the clip
    const visEndSec = Math.min(c.duration / TICKS_PER_SECOND, (this.width - x) / this.pps)
    const first = Math.floor((srcIn + visStartSec) / tileSec)
    const last = Math.ceil((srcIn + visEndSec) / tileSec)
    for (let k = first; k <= last; k++) {
      const srcT = (k + 0.5) * tileSec
      const tx = x + (k * tileSec - srcIn) * this.pps
      const idx = Math.floor(Math.min(durSec - 1e-3, Math.max(0, srcT)) / interval)
      const bmp = this.editor.media.thumb(a.id, file, durSec, level, idx)
      if (bmp) ctx.drawImage(bmp, tx, y, tw, h)
    }
  }

  private drawWaveform(
    ctx: CanvasRenderingContext2D,
    c: Clip,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const wf = this.editor.media.waveform(c.assetId!)
    if (!wf || !wf.length) return
    const peaksPerPx = wf.pps / this.pps
    let factor = 1
    while (factor * 2 <= peaksPerPx) factor *= 2
    const lvl = this.editor.media.waveformLevel(wf, factor)
    const pps = wf.pps / factor
    const srcIn = c.sourceIn / TICKS_PER_SECOND
    const mid = y + h / 2
    const amp = (h / 2 - 1) * Math.min(2, dbToGain(c.audio.gainDb))
    const x0 = Math.max(0, Math.floor(x))
    const x1 = Math.min(this.width, Math.ceil(x + w))
    ctx.fillStyle = 'rgba(19,119,68,0.75)'
    for (let px = x0; px < x1; px++) {
      const s0 = srcIn + (px - x) / this.pps
      const s1 = srcIn + (px + 1 - x) / this.pps
      let i0 = Math.floor(s0 * pps)
      const i1 = Math.max(i0 + 1, Math.floor(s1 * pps))
      if (i0 >= lvl.length) break
      if (i0 < 0) i0 = 0
      let mn = 127
      let mx = -127
      for (let i = i0; i < Math.min(i1, lvl.length); i++) {
        const lo = lvl.peaks[i * 2]!
        const hi = lvl.peaks[i * 2 + 1]!
        if (lo < mn) mn = lo
        if (hi > mx) mx = hi
      }
      if (mx < mn) continue
      const top = mid - (mx / 127) * amp
      const bot = mid - (mn / 127) * amp
      ctx.fillRect(px, top, 1, Math.max(1, bot - top))
    }
  }

  private drawMoveGhosts(
    ctx: CanvasRenderingContext2D,
    rows: Row[],
    d: Extract<Drag, { kind: 'move' }>,
  ): void {
    const seq = activeSequence(this.project)
    const byKind = {
      video: rows.filter((r) => r.track.kind === 'video'),
      audio: rows.filter((r) => r.track.kind === 'audio'),
    }
    for (const t of seq.tracks)
      for (const c of t.clips) {
        if (!d.ids.has(c.id)) continue
        let row = rows.find((r) => r.track.id === t.id)!
        if (c.id === d.clip.id && d.trackOffset) {
          // Rows are drawn top-down; video rows are reversed relative to track order.
          const list = byKind[t.kind]
          const i = list.indexOf(row)
          const ni = Math.max(
            0,
            Math.min(list.length - 1, i + (t.kind === 'video' ? -d.trackOffset : d.trackOffset)),
          )
          row = list[ni]!
        }
        this.drawClip(ctx, { ...c, start: Math.max(0, c.start + d.delta) }, row, {
          ghost: true,
          kind: t.kind,
        })
      }
  }

  drawOverlay(): void {
    const ctx = this.overlayCtx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    const d = this.drag
    const guide = d && (d.kind === 'move' || d.kind === 'trim') ? d.guide : undefined
    if (guide) {
      const gx = Math.round(this.xOf(guide.t)) + 0.5
      ctx.strokeStyle = COLORS.snap
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, this.height)
      ctx.stroke()
      ctx.setLineDash([])
    }
    const x = Math.round(this.xOf(this.editor.transport.time)) + 0.5
    if (x >= -2 && x <= this.width + 2) {
      ctx.fillStyle = COLORS.playhead
      ctx.fillRect(x - 0.5, 0, 1.5, this.height)
      ctx.beginPath()
      ctx.moveTo(x - 6, 0)
      ctx.lineTo(x + 6, 0)
      ctx.lineTo(x + 6, 10)
      ctx.lineTo(x, 16)
      ctx.lineTo(x - 6, 10)
      ctx.closePath()
      ctx.fill()
    }
  }

  // ── interaction ─────────────────────────────────────────────────────────────────────────────

  private local(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.overlay.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  hitClip(x: number, y: number): { clip: Clip; row: Row; edge?: 'start' | 'end' } | undefined {
    const row = this.rowAt(y)
    if (!row) return undefined
    const t = this.tOf(x)
    const slop = (EDGE_PX / this.pps) * TICKS_PER_SECOND
    const near = clipsInRange(row.track.clips, t - slop, t + slop)
    for (const c of near) {
      const cx0 = this.xOf(c.start)
      const cx1 = this.xOf(clipEnd(c))
      if (x < cx0 - EDGE_PX || x > cx1 + EDGE_PX) continue
      const wide = cx1 - cx0 > EDGE_PX * 3
      if (wide && Math.abs(x - cx0) <= EDGE_PX) return { clip: c, row, edge: 'start' }
      if (wide && Math.abs(x - cx1) <= EDGE_PX) return { clip: c, row, edge: 'end' }
      if (x >= cx0 && x <= cx1) return { clip: c, row }
    }
    return undefined
  }

  private snapIndex(exclude: Set<string>): SnapIndex {
    return SnapIndex.fromSequence(activeSequence(this.project), {
      playhead: this.editor.transport.time,
      excludeClipIds: exclude,
    })
  }

  private snapTicks(): Ticks {
    return (SNAP_PX / this.pps) * TICKS_PER_SECOND
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return
    const { x, y } = this.local(e)
    this.overlay.setPointerCapture(e.pointerId)
    if (y < RULER_H) {
      // Marker click jumps; anywhere else scrubs.
      const seq = activeSequence(this.project)
      const m = seq.markers.find((mk) => Math.abs(this.xOf(mk.t) - x) <= 6)
      this.drag = { kind: 'scrub' }
      this.editor.transport.seek(m ? m.t : this.frame(this.tOf(x)), { scrub: true })
      return
    }
    const hit = this.hitClip(x, y)
    const sel = this.editor.ui
    if (!hit) {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) sel.selection = []
      this.drag = { kind: 'scrub' }
      this.editor.transport.seek(this.frame(this.tOf(x)), { scrub: true })
      this.invalidate()
      return
    }
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    if (additive) {
      sel.selection = sel.selection.includes(hit.clip.id)
        ? sel.selection.filter((id) => id !== hit.clip.id)
        : [...sel.selection, hit.clip.id]
    } else if (!sel.selection.includes(hit.clip.id)) sel.selection = [hit.clip.id]
    this.invalidate()
    if (hit.row.track.locked) return
    if (hit.edge) {
      const lim = trimLimits(
        hit.row.track,
        hit.clip,
        hit.edge,
        this.project.assets,
        minClipDuration(this.project),
      )
      this.drag = {
        kind: 'trim',
        clip: hit.clip,
        row: hit.row,
        edge: hit.edge,
        x0: x,
        delta: 0,
        min: lim.min,
        max: lim.max,
        snap: this.snapIndex(new Set([hit.clip.id])),
      }
    } else this.drag = { kind: 'pending', clip: hit.clip, row: hit.row, x0: x, y0: y, additive }
  }

  private frame(t: Ticks): Ticks {
    return floorToFrame(Math.max(0, t), this.project.settings.fps)
  }

  private onMove = (e: PointerEvent): void => {
    const { x, y } = this.local(e)
    const d = this.drag
    if (!d) {
      const hit = y >= RULER_H ? this.hitClip(x, y) : undefined
      this.overlay.style.cursor = hit?.edge
        ? 'ew-resize'
        : hit
          ? hit.row.track.locked
            ? 'not-allowed'
            : 'grab'
          : y < RULER_H
            ? 'text'
            : 'default'
      return
    }
    const fps = this.project.settings.fps
    if (d.kind === 'scrub') {
      this.editor.transport.seek(this.frame(this.tOf(x)), { scrub: true })
      return
    }
    if (d.kind === 'pending') {
      if (Math.abs(x - d.x0) < 3 && Math.abs(y - d.y0) < 3) return
      const ids = new Set(
        this.editor.ui.selection.includes(d.clip.id) ? this.editor.ui.selection : [d.clip.id],
      )
      // Linked partners move too.
      const seq = activeSequence(this.project)
      const links = new Set<string>()
      for (const t of seq.tracks)
        for (const c of t.clips) if (ids.has(c.id) && c.linkId) links.add(c.linkId)
      for (const t of seq.tracks)
        for (const c of t.clips) if (c.linkId && links.has(c.linkId)) ids.add(c.id)
      this.drag = {
        kind: 'move',
        clip: d.clip,
        row: d.row,
        x0: d.x0,
        y0: d.y0,
        ids,
        delta: 0,
        trackOffset: 0,
        snap: this.snapIndex(ids),
      }
      this.overlay.style.cursor = 'grabbing'
      return this.onMove(e)
    }
    if (d.kind === 'move') {
      let delta = roundToFrame(((x - d.x0) / this.pps) * TICKS_PER_SECOND, fps)
      delta = Math.max(delta, -d.clip.start)
      d.guide = undefined
      if (this.editor.ui.snapping && !e.altKey) {
        const s = d.snap.snapSpan(d.clip.start + delta, d.clip.duration, this.snapTicks())
        if (s.point) {
          delta = s.start - d.clip.start
          d.guide = s.point
        }
      }
      d.delta = delta
      // Track change by vertical movement among rows of the same kind (top-down rows).
      const row = this.rowAt(y)
      if (row && row.track.kind === d.row.track.kind) {
        const list = this.rows().filter((r) => r.track.kind === d.row.track.kind)
        const di =
          list.findIndex((r) => r.track.id === row.track.id) -
          list.findIndex((r) => r.track.id === d.row.track.id)
        d.trackOffset = d.row.track.kind === 'video' ? -di : di
      }
      this.invalidate()
      return
    }
    if (d.kind === 'trim') {
      let delta = roundToFrame(((x - d.x0) / this.pps) * TICKS_PER_SECOND, fps)
      d.guide = undefined
      if (this.editor.ui.snapping && !e.altKey) {
        const edgeT = (d.edge === 'start' ? d.clip.start : clipEnd(d.clip)) + delta
        const p = d.snap.nearest(edgeT, this.snapTicks())
        if (p) {
          delta = p.t - (d.edge === 'start' ? d.clip.start : clipEnd(d.clip))
          d.guide = p
        }
      }
      d.delta = Math.max(d.min, Math.min(d.max, delta))
      this.invalidate()
    }
  }

  private onUp = (e: PointerEvent): void => {
    const d = this.drag
    this.drag = undefined
    try {
      this.overlay.releasePointerCapture(e.pointerId)
    } catch {
      // not captured
    }
    if (!d) return
    if (d.kind === 'move' && (d.delta || d.trackOffset)) {
      const primary = this.editor.ui.selection.includes(d.clip.id)
        ? [...this.editor.ui.selection]
        : [d.clip.id]
      this.editor.exec({
        type: 'moveClips',
        clipIds: primary,
        delta: d.delta,
        trackOffset: d.trackOffset,
      })
    } else if (d.kind === 'trim' && d.delta) {
      this.editor.exec({ type: 'trimClip', clipId: d.clip.id, edge: d.edge, delta: d.delta })
      // Show the new edge frame.
      const edgeT = d.edge === 'start' ? d.clip.start + d.delta : clipEnd(d.clip) + d.delta - 1
      this.editor.transport.seek(this.frame(edgeT))
    }
    this.editor.store.breakMerge()
    this.overlay.style.cursor = 'default'
    this.invalidate()
  }

  private onDblClick = (e: MouseEvent): void => {
    const { x, y } = this.local(e)
    const hit = this.hitClip(x, y)
    if (hit) this.editor.transport.seek(hit.clip.start)
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const { x } = this.local(e as unknown as PointerEvent)
    if (e.ctrlKey || e.metaKey) {
      this.setZoom(this.pps * Math.exp(-e.deltaY * 0.0025), x)
      return
    }
    const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
    if (horizontal) {
      this.scrollTo(this.scrollX + (e.shiftKey ? e.deltaY : e.deltaX) / this.pps)
      return
    }
    const max = Math.max(0, this.contentHeight() - this.height + 8)
    if (max > 0) {
      this.scrollY = Math.max(0, Math.min(max, this.scrollY + e.deltaY))
      this.invalidate()
    } else this.scrollTo(this.scrollX + e.deltaY / this.pps)
  }

  /** Drop position for an asset dragged from the media panel. */
  dropAt(clientX: number, clientY: number, duration: Ticks, kind: 'video' | 'audio'): DropHint {
    const r = this.overlay.getBoundingClientRect()
    const x = clientX - r.left
    const y = clientY - r.top
    let t = this.frame(this.tOf(x))
    const row = this.rowAt(y)
    const target =
      row && row.track.kind === kind && !row.track.locked
        ? row
        : this.rows().find((q) => q.track.kind === kind && !q.track.locked)
    if (this.editor.ui.snapping) {
      const s = this.snapIndex(new Set()).snapSpan(t, duration, this.snapTicks())
      t = Math.max(0, s.start)
    }
    this.dropHint = { t, row: target, duration }
    this.invalidate()
    return this.dropHint
  }

  clearDrop(): void {
    this.dropHint = undefined
    this.invalidate()
  }
}
