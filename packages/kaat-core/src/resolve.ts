/**
 * Composition resolver: the single interpretation of a project at a timestamp.
 *
 *   tracks → active clips → source time → transform → animation → effects → transitions → layers
 *
 * Preview and export both render the `FrameDescription` this returns, so they cannot disagree.
 * Cost is O(tracks · log clips) per frame: each track does a binary search, never a scan.
 */
import { evaluateTransform } from './animation'
import {
  type Asset,
  type Clip,
  type Crop,
  type Effect,
  type Project,
  type TextProps,
  type Track,
  type Transform,
  type TransitionType,
  activeSequence,
  clipAt,
  clipEnd,
  firstClipEndingAfter,
} from './model'
import { type Ticks, ticksPerFrame } from './time'

export type LayerKind = 'video' | 'image' | 'text' | 'solid'

export interface RenderLayer {
  /** Stable per clip (an outgoing transition copy gets a `:out` suffix). */
  key: string
  clipId: string
  trackId: string
  kind: LayerKind
  assetId?: string
  /** Source media time for `video` layers. */
  sourceTime: Ticks
  /** Natural media size, used to fit the layer into the canvas. */
  sourceWidth: number
  sourceHeight: number
  transform: Transform
  crop: Crop
  effects: Effect[]
  text?: TextProps
  /** Solid colour (`solid` layers, and fade-through-colour). */
  color?: string
  /** Extra offset from a slide transition, in project pixels. */
  offsetX: number
  /** Wipe reveal (0–1, left to right). 1 = fully visible. */
  reveal: number
  /** Mix toward `tintColor` by this amount (0–1). */
  tint: number
  tintColor?: string
}

export interface FrameDescription {
  t: Ticks
  width: number
  height: number
  background: string
  /** Bottom to top. */
  layers: RenderLayer[]
}

export interface ActiveTransition {
  type: TransitionType
  progress: number
  color?: string
  outgoing?: Clip
  incoming: Clip
}

/** Transition in effect on a track at `t`, if any. */
export function transitionAt(
  track: Track,
  t: Ticks,
  frameTicks: Ticks,
): ActiveTransition | undefined {
  const idx = firstClipEndingAfter(track.clips, t)
  const clip = track.clips[idx]
  if (!clip || clip.start > t || !clip.transitionIn) return undefined
  const tr = clip.transitionIn
  const local = t - clip.start
  if (local >= tr.duration) return undefined
  const prev = idx > 0 ? track.clips[idx - 1] : undefined
  const outgoing = prev && Math.abs(clipEnd(prev) - clip.start) <= frameTicks ? prev : undefined
  return {
    type: tr.type,
    progress: Math.min(1, Math.max(0, local / tr.duration)),
    color: tr.color,
    outgoing,
    incoming: clip,
  }
}

function layerFor(
  clip: Clip,
  track: Track,
  t: Ticks,
  assets: Record<string, Asset>,
  frameTicks: Ticks,
): RenderLayer | undefined {
  const local = t - clip.start
  const transform = evaluateTransform(clip, local)
  const base = {
    key: clip.id,
    clipId: clip.id,
    trackId: track.id,
    transform,
    crop: clip.crop,
    effects: clip.effects.filter((e) => e.enabled),
    offsetX: 0,
    reveal: 1,
    tint: 0,
  }
  if (clip.kind === 'text') {
    if (!clip.text) return undefined
    return {
      ...base,
      kind: 'text',
      sourceTime: 0,
      sourceWidth: 0,
      sourceHeight: 0,
      text: clip.text,
    }
  }
  const asset = clip.assetId ? assets[clip.assetId] : undefined
  if (!asset || (!asset.hasVideo && asset.kind !== 'image')) return undefined
  if (asset.kind === 'image')
    return {
      ...base,
      kind: 'image',
      assetId: asset.id,
      sourceTime: 0,
      sourceWidth: asset.width,
      sourceHeight: asset.height,
    }
  // Past the end of the source (transition handle beyond media) → hold the last frame.
  const lastFrame = Math.max(
    0,
    asset.duration - (asset.fps ? ticksPerFrame(asset.fps) : frameTicks),
  )
  const sourceTime = Math.min(Math.max(0, clip.sourceIn + local), lastFrame)
  return {
    ...base,
    kind: 'video',
    assetId: asset.id,
    sourceTime,
    sourceWidth: asset.width,
    sourceHeight: asset.height,
  }
}

/** Resolve the visual composition of the active sequence at `t`. */
export function resolveFrame(p: Project, t: Ticks): FrameDescription {
  const seq = activeSequence(p)
  const { width, height, background } = p.settings
  const frameTicks = ticksPerFrame(p.settings.fps)
  const layers: RenderLayer[] = []
  for (const track of seq.tracks) {
    if (track.kind !== 'video' || track.hidden) continue
    const tr = transitionAt(track, t, frameTicks)
    if (tr) {
      pushTransition(layers, tr, track, t, p.assets, frameTicks, width)
      continue
    }
    const clip = clipAt(track.clips, t)
    if (!clip) continue
    const layer = layerFor(clip, track, t, p.assets, frameTicks)
    if (layer) layers.push(layer)
  }
  return { t, width, height, background, layers }
}

function pushTransition(
  layers: RenderLayer[],
  tr: ActiveTransition,
  track: Track,
  t: Ticks,
  assets: Record<string, Asset>,
  frameTicks: Ticks,
  width: number,
): void {
  const p = tr.progress
  const inc = layerFor(tr.incoming, track, t, assets, frameTicks)
  const out = tr.outgoing ? layerFor(tr.outgoing, track, t, assets, frameTicks) : undefined
  if (out) out.key = `${out.clipId}:out`
  const incomingOpaque = inc?.kind === 'video' || inc?.kind === 'image'
  switch (tr.type) {
    case 'dissolve': {
      if (out) {
        // Opaque incoming media covers the outgoing clip as it fades up; transparent incoming
        // layers (text) need the outgoing clip to fade out too.
        if (!incomingOpaque)
          out.transform = { ...out.transform, opacity: out.transform.opacity * (1 - p) }
        layers.push(out)
      }
      if (inc) {
        inc.transform = { ...inc.transform, opacity: inc.transform.opacity * p }
        layers.push(inc)
      }
      return
    }
    case 'slide': {
      if (out) {
        out.offsetX = -p * width
        layers.push(out)
      }
      if (inc) {
        inc.offsetX = (1 - p) * width
        layers.push(inc)
      }
      return
    }
    case 'wipe': {
      if (out) layers.push(out)
      if (inc) {
        inc.reveal = p
        layers.push(inc)
      }
      return
    }
    case 'fadeColor': {
      const color = tr.color ?? '#000000'
      if (p < 0.5) {
        const amount = p * 2
        if (out) {
          out.tint = amount
          out.tintColor = color
          layers.push(out)
        } else layers.push(solidLayer(tr.incoming, track, color, amount))
      } else if (inc) {
        inc.tint = (1 - p) * 2
        inc.tintColor = color
        layers.push(inc)
      }
      return
    }
  }
}

function solidLayer(clip: Clip, track: Track, color: string, opacity: number): RenderLayer {
  return {
    key: `${clip.id}:solid`,
    clipId: clip.id,
    trackId: track.id,
    kind: 'solid',
    sourceTime: 0,
    sourceWidth: 0,
    sourceHeight: 0,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity },
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    effects: [],
    color,
    offsetX: 0,
    reveal: 1,
    tint: 0,
  }
}

/**
 * Video source times needed for frames in `[from, to)` per asset: drives decode-ahead and
 * export prefetch with the same rules as rendering.
 */
export function videoSourcesInRange(
  p: Project,
  from: Ticks,
  to: Ticks,
): { assetId: string; clipId: string; sourceFrom: Ticks; sourceTo: Ticks }[] {
  const seq = activeSequence(p)
  const out: { assetId: string; clipId: string; sourceFrom: Ticks; sourceTo: Ticks }[] = []
  for (const track of seq.tracks) {
    if (track.kind !== 'video' || track.hidden) continue
    const i0 = firstClipEndingAfter(track.clips, from)
    for (let i = i0; i < track.clips.length; i++) {
      const c = track.clips[i]!
      if (c.start >= to) break
      if (c.kind !== 'media' || !c.assetId) continue
      const a = p.assets[c.assetId]
      if (!a || a.kind !== 'video') continue
      const s = Math.max(from, c.start)
      const e = Math.min(to, clipEnd(c))
      out.push({
        assetId: a.id,
        clipId: c.id,
        sourceFrom: c.sourceIn + (s - c.start),
        sourceTo: c.sourceIn + (e - c.start),
      })
    }
  }
  return out
}
