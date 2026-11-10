/**
 * Media worker: metadata probing, thumbnails, waveforms, PCM for preview audio, proxies. Runs off
 * the interaction thread; every long task honours its AbortSignal so the scheduler can cancel it.
 */
import {
  AudioSampleSink,
  CanvasSink,
  Conversion,
  Mp4OutputFormat,
  Output,
  QUALITY_LOW,
  StreamTarget,
  VideoSampleSink,
  WebMOutputFormat,
} from 'mediabunny'

import { type Handlers, expose, transfer } from '../rpc'
import { InputPool, opfsRemove, opfsWritable } from './inputs'
import type { MediaApi, Pcm, ProbeResult } from './protocol'

const pool = new InputPool(6)
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i

function abortIf(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
}

const handlers: Handlers<MediaApi> = {
  async probe(file, name) {
    if (file.type.startsWith('image/') || IMAGE_EXT.test(name)) {
      const bmp = await createImageBitmap(file)
      const r: ProbeResult = {
        kind: 'image',
        durationSeconds: 0,
        startSeconds: 0,
        width: bmp.width,
        height: bmp.height,
        hasVideo: true,
        hasAudio: false,
      }
      bmp.close()
      return r
    }
    const { input } = pool.get(`probe:${name}:${file.size}:${file.lastModified}`, file)
    try {
      if (!(await input.canRead()))
        throw Object.assign(new Error('Unrecognised container'), { code: 'UNSUPPORTED_MEDIA' })
      const v = await input.getPrimaryVideoTrack()
      const a = await input.getPrimaryAudioTrack()
      if (!v && !a)
        throw Object.assign(new Error('No audio or video track'), { code: 'UNSUPPORTED_MEDIA' })
      const startSeconds = Math.max(0, await input.getFirstTimestamp())
      const end = (await input.getDurationFromMetadata()) ?? (await input.computeDuration())
      const r: ProbeResult = {
        kind: v ? 'video' : 'audio',
        durationSeconds: Math.max(0, end - startSeconds),
        startSeconds,
        width: v ? v.displayWidth : 0,
        height: v ? v.displayHeight : 0,
        hasVideo: !!v,
        hasAudio: !!a,
      }
      if (v) {
        r.videoCodec = v.codec ?? 'unknown'
        if (!(await v.canDecode())) r.undecodable = r.videoCodec
        try {
          r.fps = (await v.computePacketStats(90)).averagePacketRate
        } catch {
          r.fps = 30
        }
      }
      if (a) {
        r.audioCodec = a.codec ?? 'unknown'
        r.sampleRate = a.sampleRate
        r.channels = a.numberOfChannels
        if (!(await a.canDecode())) {
          if (!v) r.undecodable = r.audioCodec
          else r.hasAudio = false
        }
      }
      return r
    } finally {
      pool.close(`probe:${name}:${file.size}:${file.lastModified}`)
    }
  },

  async thumbnails(key, file, times, height, signal) {
    if (file.type.startsWith('image/') || (file instanceof File && IMAGE_EXT.test(file.name))) {
      const src = await createImageBitmap(file)
      const width = Math.max(1, Math.round((src.width / src.height) * height))
      const bmp = await createImageBitmap(src, {
        resizeHeight: height,
        resizeWidth: width,
        resizeQuality: 'medium',
      })
      src.close()
      const out: (ImageBitmap | null)[] = times.map((_, i) => (i === 0 ? bmp : null))
      return transfer(out, [bmp])
    }
    const { input } = pool.get(key, file)
    const track = await input.getPrimaryVideoTrack()
    if (!track) return times.map(() => null)
    const width = Math.max(
      1,
      Math.round((track.displayWidth / Math.max(1, track.displayHeight)) * height),
    )
    const sink = new CanvasSink(track, { width, height, fit: 'fill', poolSize: 0 })
    const out: (ImageBitmap | null)[] = []
    for await (const wc of sink.canvasesAtTimestamps(times)) {
      abortIf(signal)
      out.push(wc ? await createImageBitmap(wc.canvas) : null)
    }
    const bitmaps = out.filter((b): b is ImageBitmap => !!b)
    return transfer(out, bitmaps)
  },

  async waveform(key, file, peaksPerSecond, signal) {
    const { input } = pool.get(key, file)
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return 0
    const sink = new AudioSampleSink(track)
    const sr = track.sampleRate
    const perPeak = Math.max(1, Math.round(sr / peaksPerSecond))
    const chunkPeaks = peaksPerSecond * 20 // emit every ~20 s of audio
    let chunk = new Int8Array(chunkPeaks * 2)
    let inChunk = 0
    let offset = 0
    let total = 0
    let mn = 1
    let mx = -1
    let count = 0
    let scratch = new Float32Array(0)
    const flush = (done: boolean) => {
      const data = chunk.slice(0, inChunk * 2)
      emit('waveform', { key, offset, data, done, peaksPerSecond }, [data.buffer])
      offset += inChunk
      inChunk = 0
    }
    for await (const s of sink.samples()) {
      if (signal.aborted) {
        s.close()
        abortIf(signal)
      }
      const frames = s.numberOfFrames
      const chans = s.numberOfChannels
      if (scratch.length < frames) scratch = new Float32Array(frames)
      // Mix down by taking the per-sample extreme over channels.
      const mixMin = new Float32Array(frames).fill(1)
      const mixMax = new Float32Array(frames).fill(-1)
      for (let ch = 0; ch < chans; ch++) {
        const view = scratch.subarray(0, frames)
        s.copyTo(view, { planeIndex: ch, format: 'f32-planar' })
        for (let i = 0; i < frames; i++) {
          const v = view[i]!
          if (v < mixMin[i]!) mixMin[i] = v
          if (v > mixMax[i]!) mixMax[i] = v
        }
      }
      s.close()
      for (let i = 0; i < frames; i++) {
        if (mixMin[i]! < mn) mn = mixMin[i]!
        if (mixMax[i]! > mx) mx = mixMax[i]!
        if (++count === perPeak) {
          chunk[inChunk * 2] = Math.max(-127, Math.round(mn * 127))
          chunk[inChunk * 2 + 1] = Math.min(127, Math.round(mx * 127))
          inChunk++
          total++
          mn = 1
          mx = -1
          count = 0
          if (inChunk === chunkPeaks) {
            flush(false)
            chunk = new Int8Array(chunkPeaks * 2)
          }
        }
      }
    }
    flush(true)
    return total
  },

  async pcm(key, file, startSeconds, endSeconds, signal) {
    const { input } = pool.get(key, file)
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return null
    const sink = new AudioSampleSink(track)
    const parts: Float32Array[][] = []
    let first = -1
    let frames = 0
    const chans = track.numberOfChannels
    for await (const s of sink.samples(startSeconds, endSeconds)) {
      if (signal.aborted) {
        s.close()
        abortIf(signal)
      }
      if (first < 0) first = s.timestamp
      const n = s.numberOfFrames
      const planes: Float32Array[] = []
      for (let ch = 0; ch < chans; ch++) {
        const buf = new Float32Array(n)
        s.copyTo(buf, { planeIndex: Math.min(ch, s.numberOfChannels - 1), format: 'f32-planar' })
        planes.push(buf)
      }
      s.close()
      parts.push(planes)
      frames += n
    }
    if (first < 0) return null
    const channels = Array.from({ length: chans }, () => new Float32Array(frames))
    let at = 0
    for (const planes of parts) {
      for (let ch = 0; ch < chans; ch++) channels[ch]!.set(planes[ch]!, at)
      at += planes[0]!.length
    }
    const out: Pcm = { sampleRate: track.sampleRate, startSeconds: first, channels }
    return transfer(
      out,
      channels.map((c) => c.buffer),
    )
  },

  async buildProxy(key, file, path, codec, signal) {
    const { input } = pool.get(key, file)
    const writable = await opfsWritable(path)
    const output = new Output({
      format: codec === 'avc' ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat(),
      target: new StreamTarget(writable as unknown as WritableStream, { chunked: true }),
    })
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        width: 960,
        height: 540,
        fit: 'contain',
        codec,
        bitrate: QUALITY_LOW,
        keyFrameInterval: 1,
        forceTranscode: true,
      },
      audio: { discard: true },
    })
    if (!conversion.isValid) {
      await writable.abort().catch(() => {})
      throw Object.assign(new Error('This file cannot be converted to a proxy'), {
        code: 'DECODE_FAILED',
      })
    }
    conversion.onProgress = (p) => emit('proxy', { key, progress: p })
    const onAbort = () => void conversion.cancel()
    signal.addEventListener('abort', onAbort)
    try {
      await conversion.execute()
    } catch (e) {
      await opfsRemove(path)
      throw e
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
    return file.size
  },

  /** Decode `seconds` of video from the start; returns decoded frames per wall-clock second. */
  async decodeBenchmark(key, file, seconds, signal) {
    const { input } = pool.get(key, file)
    const track = await input.getPrimaryVideoTrack()
    if (!track) return Number.POSITIVE_INFINITY
    const sink = new VideoSampleSink(track)
    const t0 = performance.now()
    let n = 0
    for await (const s of sink.samples(0, seconds)) {
      s.close()
      n++
      if (signal.aborted) break
    }
    const ms = performance.now() - t0
    return ms > 0 ? (n / ms) * 1000 : Number.POSITIVE_INFINITY
  },

  async release(key) {
    pool.close(key)
  },
}

const emit = expose<MediaApi>(self as unknown as DedicatedWorkerGlobalScope, handlers)
