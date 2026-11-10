/**
 * Preview audio. The AudioContext is the master clock during playback: video follows
 * `ctx.currentTime`, so audio and video can't drift. Clip audio is scheduled in a rolling
 * look-ahead window from decoded PCM chunks; gain envelopes come from kaat-core's mix model (the
 * same functions the export mixer uses).
 */
import {
  type Project,
  TICKS_PER_SECOND,
  type Ticks,
  activeSequence,
  audioSegmentsInRange,
  gainCurve,
  Priority,
  ticksToSeconds,
} from '@khata/kaat-core'

import { type MediaService, PCM_CHUNK_SECONDS } from '../media/mediaService'
import type { SourceRegistry } from '../sources'

const LOOKAHEAD = 1.5 // seconds of audio scheduled ahead
const REFILL_AT = 0.75

export class AudioEngine {
  private ctx?: AudioContext
  private master?: GainNode
  private playing = false
  private rate = 1
  private ctxStart = 0
  private tickStart: Ticks = 0
  private scheduledUntil: Ticks = 0
  private nodes = new Set<AudioBufferSourceNode>()
  private scheduled = new Set<string>()
  private project?: Project

  constructor(
    private readonly media: MediaService,
    private readonly sources: SourceRegistry,
  ) {}

  /** Lazily create the context (must happen after a user gesture to start unmuted). */
  context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  get isPlaying(): boolean {
    return this.playing
  }

  /** Timeline time now, per the audio clock. */
  now(): Ticks {
    if (!this.playing || !this.ctx) return this.tickStart
    return this.tickStart + (this.ctx.currentTime - this.ctxStart) * this.rate * TICKS_PER_SECOND
  }

  async start(project: Project, from: Ticks, rate: number): Promise<void> {
    const ctx = this.context()
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    this.stopNodes()
    this.project = project
    this.rate = rate
    this.tickStart = from
    this.ctxStart = ctx.currentTime + 0.03
    this.scheduledUntil = from
    this.playing = true
    this.master!.gain.value = 1
    this.pump()
  }

  /** Re-schedule after an edit during playback (keeps the clock running). */
  update(project: Project): void {
    if (!this.playing) {
      this.project = project
      return
    }
    const t = this.now()
    this.project = project
    this.stopNodes()
    this.tickStart = t
    this.ctxStart = this.ctx!.currentTime
    this.scheduledUntil = t
    this.pump()
  }

  stop(): Ticks {
    const t = this.now()
    this.playing = false
    this.tickStart = t
    this.stopNodes()
    return t
  }

  /** Call every animation frame while playing. */
  pump(): void {
    if (!this.playing || !this.ctx || !this.project || this.rate <= 0) return
    const now = this.now()
    const ahead = ticksToSeconds(this.scheduledUntil - now) / this.rate
    if (ahead > REFILL_AT) return
    const from = Math.max(now, this.scheduledUntil)
    const to = now + LOOKAHEAD * this.rate * TICKS_PER_SECOND
    this.schedule(from, to)
    this.scheduledUntil = to
    // Warm the next window's chunks.
    this.prefetch(to, to + 2 * TICKS_PER_SECOND, Priority.HIGH)
  }

  /** Decode PCM chunks for a range ahead of time (called on seek, before play). */
  prefetch(
    from: Ticks,
    to: Ticks,
    priority: Priority = Priority.MEDIUM,
    project = this.project,
  ): void {
    if (!project) return
    for (const seg of audioSegmentsInRange(project, from, to)) {
      const file = this.sources.get(seg.assetId)
      if (!file) continue
      const off = ticksToSeconds(project.assets[seg.assetId]?.startTime ?? 0)
      const s0 = ticksToSeconds(seg.sourceFrom) + off
      const s1 = s0 + ticksToSeconds(seg.to - seg.from)
      for (let c = Math.floor(s0 / PCM_CHUNK_SECONDS); c <= Math.floor(s1 / PCM_CHUNK_SECONDS); c++)
        void this.media.loadPcm(seg.assetId, file, c, priority)
    }
  }

  private schedule(from: Ticks, to: Ticks): void {
    const ctx = this.ctx!
    const p = this.project!
    const seq = activeSequence(p)
    for (const seg of audioSegmentsInRange(p, from, to)) {
      const file = this.sources.get(seg.assetId)
      if (!file) continue
      const asset = p.assets[seg.assetId]
      const off = ticksToSeconds(asset?.startTime ?? 0)
      // Chunks are scheduled whole (intersected with the entire clip, not just this window), so a
      // chunk marked as scheduled never leaves a gap in a later window.
      const clip = seg.clip
      const clipSrcFrom = ticksToSeconds(clip.sourceIn) + off
      const clipSrcTo = clipSrcFrom + ticksToSeconds(clip.duration)
      const winFrom = ticksToSeconds(seg.sourceFrom) + off
      const winTo = winFrom + ticksToSeconds(seg.to - seg.from)
      const srcFrom = clipSrcFrom
      const srcTo = clipSrcTo
      const clipTl = clip.start
      for (
        let c = Math.floor(winFrom / PCM_CHUNK_SECONDS);
        c <= Math.floor(winTo / PCM_CHUNK_SECONDS);
        c++
      ) {
        const key = `${seg.clip.id}:${c}:${seg.clip.start}:${seg.clip.sourceIn}`
        if (this.scheduled.has(key)) continue
        const chunk = this.media.pcmChunk(seg.assetId, c)
        if (!chunk) {
          // Not decoded yet: request urgently; the next pump picks it up (slightly late is better
          // than silent).
          void this.media.loadPcm(seg.assetId, file, c, Priority.CRITICAL).then(() => {
            if (this.playing) {
              this.scheduledUntil = Math.min(this.scheduledUntil, this.now())
              this.pump()
            }
          })
          continue
        }
        // Part of this chunk within the segment, in source seconds.
        const cs = Math.max(srcFrom, chunk.start, c * PCM_CHUNK_SECONDS)
        const ce = Math.min(srcTo, chunk.start + chunk.buffer.duration, (c + 1) * PCM_CHUNK_SECONDS)
        if (ce <= cs) continue
        const tlStart = clipTl + (cs - srcFrom) * TICKS_PER_SECOND
        const tlEnd = tlStart + (ce - cs) * TICKS_PER_SECOND
        let when = this.ctxStart + ticksToSeconds(tlStart - this.tickStart) / this.rate
        let offset = cs - chunk.start
        let dur = (ce - cs) / this.rate
        const late = ctx.currentTime - when
        if (late > 0) {
          if (late >= dur) continue
          when = ctx.currentTime
          offset += late * this.rate
          dur -= late
        }
        const src = ctx.createBufferSource()
        src.buffer = chunk.buffer
        src.playbackRate.value = this.rate
        const g = ctx.createGain()
        const curveFrom = tlStart + Math.max(0, late) * this.rate * TICKS_PER_SECOND
        const points = Math.max(2, Math.min(512, Math.ceil(dur * 60)))
        const curve = gainCurve(p, seq, seg.track, seg.clip, curveFrom, tlEnd, points)
        try {
          g.gain.setValueCurveAtTime(curve, when, Math.max(0.001, dur))
        } catch {
          g.gain.value = curve[0] ?? 1
        }
        src.connect(g).connect(this.master!)
        src.start(when, Math.max(0, offset), Math.max(0.001, dur * this.rate))
        src.onended = () => {
          this.nodes.delete(src)
          g.disconnect()
        }
        this.nodes.add(src)
        this.scheduled.add(key)
      }
    }
  }

  private stopNodes(): void {
    for (const n of this.nodes) {
      try {
        n.stop()
      } catch {
        // already stopped
      }
      n.disconnect()
    }
    this.nodes.clear()
    this.scheduled.clear()
  }
}
