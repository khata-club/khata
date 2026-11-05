/**
 * Playback transport: play/pause, seek, scrub, frame step, J/K/L shuttle and loop range.
 *
 * The playhead lives here as a plain number, not in Vue state: per-frame updates go to listeners
 * (timeline overlay, timecode) that write straight to canvas/DOM. Playback runs on
 * requestAnimationFrame but its clock is the AudioContext (forward) or performance.now (reverse),
 * so it is independent of UI frame rate.
 */
import {
  type Project,
  TICKS_PER_SECOND,
  type Ticks,
  activeSequence,
  floorToFrame,
  frameToTicks,
  sequenceDuration,
  ticksToFrame,
} from '@khata/kaat-core'

import type { AudioEngine } from './audio/audioEngine'
import { Emitter } from './emitter'
import type { RenderService } from './render/renderService'
import { telemetry } from './telemetry'

type Events = {
  time: Ticks
  state: { playing: boolean; rate: number }
}

const SHUTTLE = [1, 2, 4, 8]

export class Transport extends Emitter<Events> {
  time: Ticks = 0
  playing = false
  rate = 1
  loop = false
  private raf = 0
  private wallStart = 0
  private tickStart: Ticks = 0
  private project!: () => Project
  private stopAt?: Ticks
  private loopRange?: [Ticks, Ticks]
  private lastFrame = -1

  constructor(
    private readonly render: RenderService,
    private readonly audio: AudioEngine,
  ) {
    super()
  }

  bind(getProject: () => Project): void {
    this.project = getProject
  }

  private fps() {
    return this.project().settings.fps
  }

  private end(): Ticks {
    return sequenceDuration(activeSequence(this.project()))
  }

  private range(): [Ticks, Ticks] {
    const seq = activeSequence(this.project())
    const end = this.end()
    const a = seq.inPoint ?? 0
    const b = seq.outPoint ?? end
    return [Math.min(a, b), Math.max(a, b)]
  }

  /** Jump to `t`. `scrub` renders a fast preview frame; otherwise a full-quality still. */
  seek(t: Ticks, opts: { scrub?: boolean } = {}): void {
    const end = Math.max(this.end(), 0)
    const clamped = Math.max(0, Math.min(t, end))
    const wasPlaying = this.playing
    if (wasPlaying) {
      const rate = this.rate
      this.pause()
      this.time = clamped
      this.play(rate)
      return
    }
    this.time = clamped
    this.emit('time', this.time)
    this.render.request(this.time, opts.scrub ? 'scrub' : 'still')
    // Warm audio around the new position so play starts promptly.
    this.audio.prefetch(this.time, this.time + 3 * TICKS_PER_SECOND, undefined, this.project())
  }

  stepFrames(n: number): void {
    if (this.playing) this.pause()
    const fps = this.fps()
    const f = ticksToFrame(this.time, fps) + n
    this.seek(frameToTicks(Math.max(0, f), fps))
  }

  play(rate = 1): void {
    if (this.playing && this.rate === rate) return
    if (this.playing) this.stopClock()
    const end = this.end()
    if (end <= 0) return
    this.rate = rate
    const [a, b] = this.range()
    this.loopRange = this.loop ? [a, b] : undefined
    if (rate > 0 && this.time >= (this.loop ? b : end) - 1) this.time = this.loop ? a : 0
    if (rate < 0 && this.time <= 0) this.time = end
    this.stopAt = rate > 0 ? (this.loop ? b : end) : 0
    this.playing = true
    this.lastFrame = -1
    this.tickStart = this.time
    this.wallStart = performance.now()
    telemetry.resetFrameClock()
    if (rate > 0) void this.audio.start(this.project(), this.time, rate)
    this.render.frameBudgetMs = 1000 / Math.max(1, this.fps().num / this.fps().den)
    this.emit('state', { playing: true, rate })
    const loop = () => {
      if (!this.playing) return
      this.tick()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private clock(): Ticks {
    if (this.rate > 0 && this.audio.isPlaying) return this.audio.now()
    return (
      this.tickStart + ((performance.now() - this.wallStart) / 1000) * this.rate * TICKS_PER_SECOND
    )
  }

  private tick(): void {
    let t = this.clock()
    if (this.rate > 0 && this.stopAt !== undefined && t >= this.stopAt) {
      if (this.loopRange) {
        // Restart the clock at the loop start.
        this.audio.stop()
        t = this.loopRange[0]
        this.time = t
        this.tickStart = t
        this.wallStart = performance.now()
        void this.audio.start(this.project(), t, this.rate)
      } else {
        this.time = floorToFrame(this.stopAt - 1, this.fps())
        this.pause()
        return
      }
    }
    if (this.rate < 0 && t <= 0) {
      this.time = 0
      this.pause()
      return
    }
    this.time = t
    this.audio.pump()
    // Render only when the frame changes: rAF runs faster than most project frame rates.
    const frame = floorToFrame(t, this.fps())
    if (frame !== this.lastFrame) {
      this.lastFrame = frame
      // Reverse can't use forward decoders: render it as a scrub.
      this.render.request(frame, this.rate > 0 && this.rate <= 2 ? 'play' : 'scrub')
    }
    this.emit('time', t)
  }

  private stopClock(): void {
    cancelAnimationFrame(this.raf)
    this.audio.stop()
  }

  pause(): void {
    if (!this.playing) return
    this.time = this.clock()
    this.stopClock()
    this.playing = false
    this.time = floorToFrame(Math.max(0, this.time), this.fps())
    this.render.playbackStopped()
    this.render.request(this.time, 'still')
    this.emit('time', this.time)
    this.emit('state', { playing: false, rate: this.rate })
  }

  toggle(): void {
    if (this.playing) this.pause()
    else this.play(1)
  }

  /** J/K/L shuttle. Repeated J or L speeds up; K stops. */
  shuttle(key: 'j' | 'k' | 'l'): void {
    if (key === 'k') {
      this.pause()
      return
    }
    const dir = key === 'l' ? 1 : -1
    let next = dir
    if (this.playing && Math.sign(this.rate) === dir) {
      const i = SHUTTLE.indexOf(Math.abs(this.rate))
      next = dir * SHUTTLE[Math.min(SHUTTLE.length - 1, i + 1)]!
    }
    this.play(next)
  }

  /** Re-sync audio after an edit during playback (the render service redraws on its own). */
  projectChanged(p: Project): void {
    if (this.playing && this.rate > 0) this.audio.update(p)
  }

  setLoop(on: boolean): void {
    this.loop = on
    if (this.playing) {
      const r = this.rate
      this.pause()
      this.play(r)
    }
  }
}
