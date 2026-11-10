/**
 * Audio mix model. Both the realtime preview (WebAudio gain automation) and the offline export
 * mixer read gain from {@link clipGainAt}, so they produce equivalent mixes.
 */
import {
  type Clip,
  type Project,
  type Sequence,
  type Track,
  activeSequence,
  clipEnd,
  firstClipEndingAfter,
} from './model'
import { TICKS_PER_SECOND, type Ticks } from './time'

export function dbToGain(db: number): number {
  return db <= -60 ? 0 : Math.pow(10, db / 20)
}

export function gainToDb(g: number): number {
  return g <= 0.001 ? -60 : 20 * Math.log10(g)
}

/** Whether a track is heard, honouring mute and solo across the sequence. */
export function trackAudible(seq: Sequence, track: Track): boolean {
  if (track.muted) return false
  const anySolo = seq.tracks.some((t) => t.kind === track.kind && t.solo)
  return anySolo ? track.solo : true
}

/** Fade envelope (0–1) at clip-local time `local`. Linear ramps. */
export function fadeEnvelope(clip: Clip, local: Ticks): number {
  let g = 1
  const { fadeIn, fadeOut } = clip.audio
  if (fadeIn > 0 && local < fadeIn) g *= Math.max(0, local / fadeIn)
  const fromEnd = clip.duration - local
  if (fadeOut > 0 && fromEnd < fadeOut) g *= Math.max(0, fromEnd / fadeOut)
  return g
}

/** Static (non-envelope) gain of a clip on a track, including track and master gain. */
export function clipStaticGain(p: Project, seq: Sequence, track: Track, clip: Clip): number {
  if (!trackAudible(seq, track)) return 0
  return dbToGain(clip.audio.gainDb) * dbToGain(track.gainDb) * dbToGain(p.settings.masterGainDb)
}

/** Linear gain applied to `clip` at timeline tick `t`. */
export function clipGainAt(p: Project, seq: Sequence, track: Track, clip: Clip, t: Ticks): number {
  return clipStaticGain(p, seq, track, clip) * fadeEnvelope(clip, t - clip.start)
}

export interface AudioSegment {
  clip: Clip
  track: Track
  assetId: string
  /** Timeline range covered by this segment (already intersected with the query range). */
  from: Ticks
  to: Ticks
  /** Source time at `from`. */
  sourceFrom: Ticks
}

/** Audible audio segments overlapping `[from, to)`. O(tracks · log clips + k). */
export function audioSegmentsInRange(p: Project, from: Ticks, to: Ticks): AudioSegment[] {
  const seq = activeSequence(p)
  const out: AudioSegment[] = []
  for (const track of seq.tracks) {
    if (track.kind !== 'audio' || !trackAudible(seq, track)) continue
    for (let i = firstClipEndingAfter(track.clips, from); i < track.clips.length; i++) {
      const c = track.clips[i]!
      if (c.start >= to) break
      if (c.kind !== 'media' || !c.assetId) continue
      const a = p.assets[c.assetId]
      if (!a || !a.hasAudio || a.status !== 'ready') continue
      const s = Math.max(from, c.start)
      const e = Math.min(to, clipEnd(c), c.start + Math.max(0, a.duration - c.sourceIn))
      if (e <= s) continue
      out.push({
        clip: c,
        track,
        assetId: a.id,
        from: s,
        to: e,
        sourceFrom: c.sourceIn + (s - c.start),
      })
    }
  }
  return out
}

/** Planar PCM decoded from a source, starting at `startSeconds` in source time. */
export interface PcmBlock {
  sampleRate: number
  startSeconds: number
  channels: Float32Array[]
}

/**
 * Mix one block of output audio. Pure and synchronous: the caller decodes the needed source
 * ranges first (see {@link audioSegmentsInRange}) and passes them in `sources`, keyed by
 * `clip.id`. Resamples linearly to `outRate` and applies the shared gain model per sample.
 *
 * `out` channels are added into, so the caller zero-fills them.
 */
export function mixBlock(
  p: Project,
  blockStart: Ticks,
  outRate: number,
  out: Float32Array[],
  segments: AudioSegment[],
  sources: Map<string, PcmBlock>,
): void {
  const seq = activeSequence(p)
  const frames = out[0]?.length ?? 0
  for (const seg of segments) {
    const src = sources.get(seg.clip.id)
    if (!src || !src.channels.length) continue
    const staticGain = clipStaticGain(p, seq, seg.track, seg.clip)
    if (staticGain === 0) continue
    const i0 = Math.max(0, Math.ceil(((seg.from - blockStart) * outRate) / TICKS_PER_SECOND - 1e-9))
    const i1 = Math.min(
      frames,
      Math.ceil(((seg.to - blockStart) * outRate) / TICKS_PER_SECOND - 1e-9),
    )
    const srcLen = src.channels[0]!.length
    for (let i = i0; i < i1; i++) {
      const tl = blockStart + (i * TICKS_PER_SECOND) / outRate
      const g = staticGain * fadeEnvelope(seg.clip, tl - seg.clip.start)
      if (g === 0) continue
      const srcSec = (seg.clip.sourceIn + (tl - seg.clip.start)) / TICKS_PER_SECOND
      const pos = (srcSec - src.startSeconds) * src.sampleRate
      const k = Math.floor(pos)
      if (k < 0 || k >= srcLen) continue
      const frac = pos - k
      const k1 = k + 1 < srcLen ? k + 1 : k
      for (let ch = 0; ch < out.length; ch++) {
        // Mono sources feed every output channel; extra source channels are dropped.
        const data = src.channels[Math.min(ch, src.channels.length - 1)]!
        const v = data[k]! + (data[k1]! - data[k]!) * frac
        out[ch]![i]! += v * g
      }
    }
  }
  // Soft safety clip.
  for (const ch of out)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.max(-1, Math.min(1, ch[i]!))
}

/**
 * Gain automation curve for WebAudio `setValueCurveAtTime` over `[from, to)`: `points` samples of
 * {@link clipGainAt}. Only the envelope varies; the static part is folded in.
 */
export function gainCurve(
  p: Project,
  seq: Sequence,
  track: Track,
  clip: Clip,
  from: Ticks,
  to: Ticks,
  points: number,
): Float32Array {
  const n = Math.max(2, points)
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++)
    curve[i] = clipGainAt(p, seq, track, clip, from + ((to - from) * i) / (n - 1))
  return curve
}
