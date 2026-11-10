/**
 * Canonical time model.
 *
 * All authoritative times are integer **ticks**. One tick is 1/705,600,000 s (a "flick"). Every
 * common video frame rate (23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 120) and the
 * common audio sample rates (44.1 kHz, 48 kHz, 96 kHz) divide a second into a whole number of
 * ticks, so frame and sample boundaries are exact. `Number.MAX_SAFE_INTEGER` ticks is ~147 days.
 *
 * Floating-point seconds and microseconds appear only at API edges (WebCodecs, WebAudio,
 * Mediabunny) and are converted here and nowhere else.
 */

export type Ticks = number

export const TICKS_PER_SECOND = 705_600_000

/** A frame rate or other rational number, `num / den`. */
export interface Rational {
  num: number
  den: number
}

export const FPS = {
  '23.976': { num: 24000, den: 1001 },
  '24': { num: 24, den: 1 },
  '25': { num: 25, den: 1 },
  '29.97': { num: 30000, den: 1001 },
  '30': { num: 30, den: 1 },
  '50': { num: 50, den: 1 },
  '59.94': { num: 60000, den: 1001 },
  '60': { num: 60, den: 1 },
} as const satisfies Record<string, Rational>

export function rationalToNumber(r: Rational): number {
  return r.num / r.den
}

export function sameRational(a: Rational, b: Rational): boolean {
  return a.num * b.den === b.num * a.den
}

/** Ticks in one frame. Exact (an integer) for every rate in {@link FPS}. */
export function ticksPerFrame(fps: Rational): number {
  return (TICKS_PER_SECOND * fps.den) / fps.num
}

/** Start tick of frame `frame`. Rounded so non-standard rates still land on integer ticks. */
export function frameToTicks(frame: number, fps: Rational): Ticks {
  return Math.round((frame * TICKS_PER_SECOND * fps.den) / fps.num)
}

/** The frame that contains tick `t` (floor). */
export function ticksToFrame(t: Ticks, fps: Rational): number {
  // The epsilon guards exact boundaries against float division error at x/1001 rates.
  return Math.floor((t * fps.num) / (TICKS_PER_SECOND * fps.den) + 1e-9)
}

/** Snap `t` to the start of its frame. */
export function floorToFrame(t: Ticks, fps: Rational): Ticks {
  return frameToTicks(ticksToFrame(t, fps), fps)
}

/** Snap `t` to the nearest frame boundary. */
export function roundToFrame(t: Ticks, fps: Rational): Ticks {
  return frameToTicks(Math.round((t * fps.num) / (TICKS_PER_SECOND * fps.den)), fps)
}

export function secondsToTicks(s: number): Ticks {
  return Math.round(s * TICKS_PER_SECOND)
}

export function ticksToSeconds(t: Ticks): number {
  return t / TICKS_PER_SECOND
}

export function ticksToMicros(t: Ticks): number {
  return Math.round((t * 1_000_000) / TICKS_PER_SECOND)
}

export function microsToTicks(us: number): Ticks {
  return Math.round((us * TICKS_PER_SECOND) / 1_000_000)
}

/** Number of whole audio samples before tick `t` at `sampleRate`. */
export function ticksToSamples(t: Ticks, sampleRate: number): number {
  return Math.floor((t * sampleRate) / TICKS_PER_SECOND + 1e-9)
}

export function samplesToTicks(samples: number, sampleRate: number): Ticks {
  return Math.round((samples * TICKS_PER_SECOND) / sampleRate)
}

/** `HH:MM:SS:FF` non-drop timecode using the nominal (rounded) rate, like most NLE defaults. */
export function formatTimecode(t: Ticks, fps: Rational): string {
  const nominal = Math.max(1, Math.round(rationalToNumber(fps)))
  const frame = ticksToFrame(Math.max(0, t), fps)
  const ff = frame % nominal
  const totalSeconds = Math.floor(frame / nominal)
  const ss = totalSeconds % 60
  const mm = Math.floor(totalSeconds / 60) % 60
  const hh = Math.floor(totalSeconds / 3600)
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`
}

/** Compact human duration, e.g. `1:05:03` or `0:42.5`. */
export function formatDuration(t: Ticks): string {
  const s = ticksToSeconds(Math.max(0, t))
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  const sec = s % 60
  if (h > 0) return `${h}:${pad(m)}:${pad(Math.floor(sec))}`
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Best-fit rational for a measured float rate (e.g. 29.970029 → 30000/1001). */
export function rationalFromFloat(rate: number): Rational {
  if (!Number.isFinite(rate) || rate <= 0) return { num: 30, den: 1 }
  for (const r of Object.values(FPS)) {
    if (Math.abs(rationalToNumber(r) - rate) < 0.01) return { num: r.num, den: r.den }
  }
  const rounded = Math.round(rate)
  if (Math.abs(rounded - rate) < 0.05) return { num: rounded, den: 1 }
  return { num: Math.round(rate * 1000), den: 1000 }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
