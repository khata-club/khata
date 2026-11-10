/**
 * Export worker. Renders the project deterministically by stepping output frames by tick: the
 * same resolver, compositor and mixer as preview, independent of realtime. Output is written
 * progressively to a WritableStream (a file on disk), so memory stays bounded for any length.
 */
import {
  type Project,
  TICKS_PER_SECOND,
  audioSegmentsInRange,
  frameToTicks,
  mixBlock,
  type PcmBlock,
  resolveFrame,
  ticksToFrame,
  ticksToSeconds,
} from '@khata/kaat-core'
import {
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  WebMOutputFormat,
} from 'mediabunny'

import { InputPool } from '../media/inputs'
import { Compositor } from '../render/compositor'
import { FrameProvider } from '../render/frameProvider'
import { loadFonts } from '../render/text'
import { type Handlers, expose } from '../rpc'
import type { ExportApi, ExportJob, ExportResult } from './protocol'

/** Streams decoded PCM forward for one clip; restarts only on a jump. */
class PcmReader {
  private it?: AsyncGenerator<AudioSample, void, unknown>
  private parts: { start: number; end: number; planes: Float32Array[] }[] = []
  private done = false

  constructor(
    private readonly sink: AudioSampleSink,
    private readonly channels: number,
    private readonly sampleRate: number,
  ) {}

  async read(from: number, to: number): Promise<PcmBlock | undefined> {
    const first = this.parts[0]
    const last = this.parts[this.parts.length - 1]
    if (!this.it || !first || from < first.start - 1e-3 || (last && from > last.end + 1))
      await this.restart(from)
    while (!this.done && (this.parts[this.parts.length - 1]?.end ?? -1) < to) {
      const r = await this.it!.next()
      if (r.done) {
        this.done = true
        break
      }
      const s = r.value
      const planes: Float32Array[] = []
      for (let ch = 0; ch < this.channels; ch++) {
        const buf = new Float32Array(s.numberOfFrames)
        s.copyTo(buf, { planeIndex: Math.min(ch, s.numberOfChannels - 1), format: 'f32-planar' })
        planes.push(buf)
      }
      this.parts.push({
        start: s.timestamp,
        end: s.timestamp + s.numberOfFrames / s.sampleRate,
        planes,
      })
      s.close()
    }
    // Drop data well behind the read window (bounded memory).
    while (this.parts.length > 1 && this.parts[0]!.end < from - 0.25) this.parts.shift()
    if (!this.parts.length) return undefined
    const total = this.parts.reduce((n, p) => n + p.planes[0]!.length, 0)
    const channels = Array.from({ length: this.channels }, () => new Float32Array(total))
    let at = 0
    for (const p of this.parts) {
      for (let ch = 0; ch < this.channels; ch++) channels[ch]!.set(p.planes[ch]!, at)
      at += p.planes[0]!.length
    }
    return { sampleRate: this.sampleRate, startSeconds: this.parts[0]!.start, channels }
  }

  private async restart(from: number): Promise<void> {
    await this.close()
    this.parts = []
    this.done = false
    this.it = this.sink.samples(Math.max(0, from - 0.05))
  }

  async close(): Promise<void> {
    if (this.it) await this.it.return(undefined).catch(() => {})
    this.it = undefined
  }
}

const handlers: Handlers<ExportApi> = {
  async run(job: ExportJob, writable: WritableStream, signal: AbortSignal): Promise<ExportResult> {
    const p: Project = job.project
    const { width, height } = job
    const canvas = new OffscreenCanvas(width, height)
    const compositor = new Compositor(canvas, { preserveDrawingBuffer: true })
    const provider = new FrameProvider(compositor, {
      textureBudget: 384 * 1024 * 1024,
      useProxies: false,
    })
    const fonts = loadFonts(job.fonts)
    provider.setFonts(fonts)
    for (const [id, blob] of Object.entries(job.files)) provider.setFile(id, blob)
    provider.rasterScale = height / p.settings.height
    provider.maxTextureWidth = width
    provider.maxTextureHeight = height
    const audioPool = new InputPool(16)
    const readers = new Map<string, PcmReader>()

    const output = new Output({
      format:
        job.container === 'mp4'
          ? new Mp4OutputFormat({ fastStart: false })
          : new WebMOutputFormat(),
      target: new StreamTarget(writable as WritableStream, {
        chunked: true,
        chunkSize: 8 * 1024 * 1024,
      }),
    })
    const fpsNum = job.fps.num / job.fps.den
    const videoSource = new CanvasSource(canvas, {
      codec: job.video.codec,
      bitrate: job.video.bitrate,
      keyFrameInterval: 2,
    })
    output.addVideoTrack(videoSource, { frameRate: fpsNum })
    const sampleRate = 48000
    const channels = 2
    let audioSource: AudioSampleSource | undefined
    if (job.audio) {
      audioSource = new AudioSampleSource({ codec: job.audio.codec, bitrate: job.audio.bitrate })
      output.addAudioTrack(audioSource)
    }
    const onAbort = () => void output.cancel().catch(() => {})
    signal.addEventListener('abort', onAbort)
    const startedAt = performance.now()
    let frames = 0
    try {
      await fonts
      await output.start()
      const { from, to } = job.range
      const total = Math.max(1, ticksToFrame(to - from, job.fps))
      const scale = height / p.settings.height
      let audioDone = from // timeline tick up to which audio has been written
      const block = sampleRate // 1 s blocks

      const writeAudioUntil = async (until: number) => {
        if (!audioSource) return
        while (audioDone < until && audioDone < to) {
          const frameCount = Math.min(
            block,
            Math.ceil(((to - audioDone) * sampleRate) / TICKS_PER_SECOND),
          )
          if (frameCount <= 0) break
          const blockEnd = audioDone + Math.round((frameCount * TICKS_PER_SECOND) / sampleRate)
          const segments = audioSegmentsInRange(p, audioDone, blockEnd)
          const sources = new Map<string, PcmBlock>()
          for (const seg of segments) {
            const asset = p.assets[seg.assetId]
            const blob = job.files[seg.assetId]
            if (!asset || !blob) continue
            let reader = readers.get(seg.clip.id)
            if (!reader) {
              const { input } = audioPool.get(seg.assetId, blob)
              const track = await input.getPrimaryAudioTrack()
              if (!track) continue
              reader = new PcmReader(
                new AudioSampleSink(track),
                Math.max(1, Math.min(2, track.numberOfChannels)),
                track.sampleRate,
              )
              readers.set(seg.clip.id, reader)
            }
            const offset = ticksToSeconds(asset.startTime ?? 0)
            const srcFrom = ticksToSeconds(seg.sourceFrom) + offset
            const srcTo = srcFrom + ticksToSeconds(seg.to - seg.from) + 0.01
            const pcm = await reader.read(srcFrom, srcTo)
            if (pcm) sources.set(seg.clip.id, { ...pcm, startSeconds: pcm.startSeconds - offset })
          }
          const out = Array.from({ length: channels }, () => new Float32Array(frameCount))
          mixBlock(p, audioDone, sampleRate, out, segments, sources)
          const planar = new Float32Array(frameCount * channels)
          for (let ch = 0; ch < channels; ch++) planar.set(out[ch]!, ch * frameCount)
          const sample = new AudioSample({
            data: planar,
            format: 'f32-planar',
            numberOfChannels: channels,
            sampleRate,
            timestamp: ticksToSeconds(audioDone - from),
          })
          await audioSource.add(sample)
          sample.close()
          audioDone = blockEnd
        }
      }

      for (let n = 0; ; n++) {
        if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
        const t = from + frameToTicks(n, job.fps)
        if (t >= to) break
        const frame = resolveFrame(p, t)
        const { textures } = await provider.prepare(frame, p.assets, true)
        compositor.render(frame, (l) => textures.get(l.key), scale)
        const ts = ticksToSeconds(t - from)
        const dur = ticksToSeconds(frameToTicks(n + 1, job.fps) - frameToTicks(n, job.fps))
        await videoSource.add(ts, dur)
        frames++
        // Keep audio about a second ahead of video so the muxer interleaves smoothly.
        await writeAudioUntil(t + TICKS_PER_SECOND)
        if (n % 5 === 0) {
          const elapsed = (performance.now() - startedAt) / 1000
          emit('progress', { frame: n, total, fps: n / Math.max(0.001, elapsed) })
          await provider.releaseIdleReaders(10)
        }
      }
      await writeAudioUntil(to)
      videoSource.close()
      audioSource?.close()
      await output.finalize()
      emit('progress', {
        frame: total,
        total,
        fps: frames / Math.max(0.001, (performance.now() - startedAt) / 1000),
      })
      return {
        frames,
        seconds: (performance.now() - startedAt) / 1000,
        mimeType: await output.getMimeType(),
      }
    } catch (e) {
      if (output.state !== 'canceled' && output.state !== 'finalized')
        await output.cancel().catch(() => {})
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      throw e
    } finally {
      signal.removeEventListener('abort', onAbort)
      await provider.closeReaders()
      provider.trim()
      for (const r of readers.values()) await r.close()
      audioPool.closeAll()
      compositor.dispose()
    }
  },
}

const emit = expose<ExportApi>(self as unknown as DedicatedWorkerGlobalScope, handlers)
