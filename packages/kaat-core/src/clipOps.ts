/**
 * Pure clip and track helpers. Every function returns new objects and never mutates its inputs.
 * Tracks keep the invariant: clips sorted by `start` and never overlapping.
 */
import { shiftChannel, splitChannel } from './animation'
import {
  ANIMATABLE_PROPS,
  type Asset,
  type Clip,
  type Keyframe,
  type Track,
  clipEnd,
  firstClipEndingAfter,
  maxSourceDuration,
  newId,
} from './model'
import type { Ticks } from './time'

function mapKeyframes(clip: Clip, fn: (list: Keyframe[]) => Keyframe[]): Clip['keyframes'] {
  const out: Clip['keyframes'] = {}
  for (const p of ANIMATABLE_PROPS) {
    const l = clip.keyframes[p]
    if (l && l.length) out[p] = fn(l)
  }
  return out
}

/** Keep fades and the head transition inside the clip after its duration changed. */
export function clampClipExtras(c: Clip): Clip {
  const fadeIn = Math.min(c.audio.fadeIn, c.duration)
  const fadeOut = Math.min(c.audio.fadeOut, c.duration - fadeIn)
  const tr = c.transitionIn
  const transitionIn = tr && tr.duration > c.duration ? { ...tr, duration: c.duration } : tr
  if (fadeIn === c.audio.fadeIn && fadeOut === c.audio.fadeOut && transitionIn === tr) return c
  const n: Clip = { ...c, audio: { ...c.audio, fadeIn, fadeOut } }
  if (transitionIn) n.transitionIn = transitionIn
  return n
}

/** Move the clip's head to `newStart`, keeping the content under the tail in place. */
export function withStart(c: Clip, newStart: Ticks): Clip {
  const delta = newStart - c.start
  if (delta === 0) return c
  return clampClipExtras({
    ...c,
    start: newStart,
    duration: c.duration - delta,
    sourceIn: c.kind === 'media' ? c.sourceIn + delta : c.sourceIn,
    keyframes: mapKeyframes(c, (l) => shiftChannel(l, -delta)),
  })
}

/** Move the clip's tail to `newEnd`. */
export function withEnd(c: Clip, newEnd: Ticks): Clip {
  const d = newEnd - c.start
  if (d === c.duration) return c
  return clampClipExtras({ ...c, duration: d })
}

/**
 * Split at absolute tick `t` (strictly inside the clip). Returns `[left, right]`; the right part
 * gets a new id and `rightLinkId` (or no link). Animation values are continuous across the cut.
 */
export function splitClip(c: Clip, t: Ticks, rightLinkId?: string): [Clip, Clip] {
  const local = t - c.start
  const leftKf: Clip['keyframes'] = {}
  const rightKf: Clip['keyframes'] = {}
  const leftBase = { ...c.transform }
  const rightBase = { ...c.transform }
  for (const p of ANIMATABLE_PROPS) {
    const l = c.keyframes[p]
    if (!l || !l.length) continue
    const { left, right } = splitChannel(l, local, c.transform[p])
    if (left.length) leftKf[p] = left
    else leftBase[p] = l[0]!.v
    if (right.length) rightKf[p] = right
    else rightBase[p] = l[l.length - 1]!.v
  }
  const left = clampClipExtras({
    ...c,
    duration: local,
    transform: leftBase,
    keyframes: leftKf,
    audio: { ...c.audio, fadeOut: 0 },
  })
  const right: Clip = {
    ...c,
    id: newId('clp'),
    start: t,
    duration: c.duration - local,
    sourceIn: c.kind === 'media' ? c.sourceIn + local : c.sourceIn,
    transform: rightBase,
    keyframes: rightKf,
    audio: { ...c.audio, fadeIn: 0 },
  }
  delete right.transitionIn
  if (rightLinkId) right.linkId = rightLinkId
  else delete right.linkId
  return [left, clampClipExtras(right)]
}

/** Insert keeping sort order. Assumes the range is already clear. */
export function insertSorted(clips: readonly Clip[], clip: Clip): Clip[] {
  const out = clips.slice()
  let lo = 0
  let hi = out.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (out[mid]!.start < clip.start) lo = mid + 1
    else hi = mid
  }
  out.splice(lo, 0, clip)
  return out
}

/**
 * Clear `[from, to)` on a track (overwrite edit): clips fully inside are removed, clips straddling
 * an edge are trimmed, and a clip spanning the whole range is split around it.
 */
export function clearRange(clips: readonly Clip[], from: Ticks, to: Ticks): Clip[] {
  if (to <= from) return clips.slice()
  const i0 = firstClipEndingAfter(clips, from)
  let i1 = i0
  while (i1 < clips.length && clips[i1]!.start < to) i1++
  if (i0 === i1) return clips.slice()
  const replaced: Clip[] = []
  for (let i = i0; i < i1; i++) {
    const c = clips[i]!
    const end = clipEnd(c)
    if (c.start >= from && end <= to) continue
    if (c.start < from && end > to) {
      const [left, rest] = splitClip(c, from)
      const [, right] = splitClip(rest, to)
      replaced.push(left, right)
    } else if (c.start < from) {
      replaced.push(withEnd(c, from))
    } else {
      replaced.push(withStart(c, to))
    }
  }
  return [...clips.slice(0, i0), ...replaced, ...clips.slice(i1)]
}

/** Overwrite-place `clip` onto `clips`. */
export function placeClip(clips: readonly Clip[], clip: Clip): Clip[] {
  return insertSorted(clearRange(clips, clip.start, clipEnd(clip)), clip)
}

/**
 * Allowed range of trim deltas for one edge of a clip on its track. Respects neighbours, the source
 * length and a minimum duration.
 */
export function trimLimits(
  track: Track,
  clip: Clip,
  edge: 'start' | 'end',
  assets: Record<string, Asset>,
  minDuration: Ticks,
): { min: Ticks; max: Ticks } {
  const idx = track.clips.findIndex((c) => c.id === clip.id)
  const prev = idx > 0 ? track.clips[idx - 1] : undefined
  const next = idx >= 0 ? track.clips[idx + 1] : undefined
  const maxSrc = maxSourceDuration(clip, assets)
  if (edge === 'start') {
    let earliest = prev ? clipEnd(prev) : 0
    if (Number.isFinite(maxSrc)) earliest = Math.max(earliest, clip.start - clip.sourceIn)
    return { min: earliest - clip.start, max: clip.duration - minDuration }
  }
  let latest = next ? next.start : Number.POSITIVE_INFINITY
  if (Number.isFinite(maxSrc)) latest = Math.min(latest, clip.start + (maxSrc - clip.sourceIn))
  return { min: minDuration - clip.duration, max: latest - clipEnd(clip) }
}
