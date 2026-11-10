import type { AnimatableProp, Clip, Interpolation, Keyframe, Transform } from './model'
import type { Ticks } from './time'

/**
 * Value of a keyframed channel at clip-local time `t`. Deterministic: same inputs → same output,
 * which is what keeps preview and export identical.
 *
 * - No keyframes → `base`.
 * - Before the first / after the last keyframe → that keyframe's value.
 * - Between `a` and `b`: `a.interp === 'hold'` keeps `a.v`; `linear` interpolates.
 */
export function evaluateChannel(
  kfs: readonly Keyframe[] | undefined,
  t: Ticks,
  base: number,
): number {
  if (!kfs || kfs.length === 0) return base
  const first = kfs[0]!
  if (t <= first.t) return first.v
  const last = kfs[kfs.length - 1]!
  if (t >= last.t) return last.v
  let lo = 0
  let hi = kfs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1
    if (kfs[mid]!.t <= t) lo = mid
    else hi = mid
  }
  const a = kfs[lo]!
  const b = kfs[hi]!
  if (a.interp === 'hold' || b.t === a.t) return a.v
  const u = (t - a.t) / (b.t - a.t)
  return a.v + (b.v - a.v) * u
}

export function evaluateTransform(clip: Clip, localT: Ticks): Transform {
  const k = clip.keyframes
  const b = clip.transform
  return {
    x: evaluateChannel(k.x, localT, b.x),
    y: evaluateChannel(k.y, localT, b.y),
    scale: evaluateChannel(k.scale, localT, b.scale),
    rotation: evaluateChannel(k.rotation, localT, b.rotation),
    opacity: evaluateChannel(k.opacity, localT, b.opacity),
  }
}

/** Insert or replace (same tick) a keyframe, keeping the list sorted. Returns a new array. */
export function upsertKeyframe(
  kfs: readonly Keyframe[] | undefined,
  t: Ticks,
  v: number,
  interp?: Interpolation,
): Keyframe[] {
  const list = kfs ? [...kfs] : []
  const i = list.findIndex((k) => k.t === t)
  if (i >= 0) {
    list[i] = { t, v, interp: interp ?? list[i]!.interp }
    return list
  }
  let at = list.findIndex((k) => k.t > t)
  if (at < 0) at = list.length
  list.splice(at, 0, { t, v, interp: interp ?? 'linear' })
  return list
}

export function hasKeyframes(clip: Clip, prop?: AnimatableProp): boolean {
  if (prop) return (clip.keyframes[prop]?.length ?? 0) > 0
  return Object.values(clip.keyframes).some((l) => (l?.length ?? 0) > 0)
}

/** Every distinct keyframe time on the clip (for timeline diamonds), sorted. */
export function keyframeTimes(clip: Clip): Ticks[] {
  const set = new Set<number>()
  for (const l of Object.values(clip.keyframes)) for (const k of l ?? []) set.add(k.t)
  return [...set].sort((a, b) => a - b)
}

/**
 * Split a channel at clip-local `at`. Both halves keep their values: a boundary keyframe is added
 * where needed, so evaluation on either side of the cut is unchanged.
 */
export function splitChannel(
  kfs: readonly Keyframe[],
  at: Ticks,
  base: number,
): { left: Keyframe[]; right: Keyframe[] } {
  const v = evaluateChannel(kfs, at, base)
  const before = kfs.filter((k) => k.t < at)
  const after = kfs.filter((k) => k.t > at).map((k) => ({ ...k, t: k.t - at }))
  const onCut = kfs.find((k) => k.t === at)
  const prev = before[before.length - 1]
  const interp: Interpolation = onCut?.interp ?? prev?.interp ?? 'linear'
  const left = before.length ? [...before, { t: at, v, interp }] : []
  const right = after.length || onCut ? [{ t: 0, v, interp }, ...after] : []
  return { left, right }
}

/** Shift a channel by `delta` ticks (trim start moves the clip origin; keyframes stay on content). */
export function shiftChannel(kfs: readonly Keyframe[], delta: Ticks): Keyframe[] {
  return kfs.map((k) => ({ ...k, t: k.t + delta }))
}
