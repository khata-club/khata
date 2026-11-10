/**
 * Export orchestration on the main thread: picks codecs, opens the destination file, runs the
 * export in a dedicated worker (terminated afterwards, which frees every decoder, encoder and
 * texture it used), reports progress and supports cancellation.
 */
import {
  KaatError,
  type Project,
  type Rational,
  activeSequence,
  sequenceDuration,
  toKaatError,
} from '@khata/kaat-core'

import type { CapabilityReport } from '../capabilities'
import { Emitter } from '../emitter'
import { BUNDLED_FONTS } from '../fonts'
import { opfsFile, opfsRemove, opfsWritable } from '../media/inputs'
import { ensureSpace } from '../persist/storage'
import { createClient, isAbort } from '../rpc'
import { telemetry } from '../telemetry'
import ExportWorker from './export.worker?worker'
import type { ExportApi, ExportJob, ExportProgress, ExportResult } from './protocol'

export type ResolutionPreset = 'project' | '720' | '1080' | '1440' | '2160'
export type QualityPreset = 'low' | 'medium' | 'high' | 'manual'

export interface ExportOptions {
  resolution: ResolutionPreset
  fps: 'project' | '24' | '25' | '30' | '50' | '60'
  quality: QualityPreset
  /** Mbps, when quality is manual. */
  bitrateMbps: number
  audioKbps: number
  format: 'mp4' | 'webm'
  range: 'all' | 'inout'
  /** Save to Downloads instead of a chosen location. */
  download: boolean
  fileName: string
}

const BPP: Record<Exclude<QualityPreset, 'manual'>, number> = {
  low: 0.045,
  medium: 0.075,
  high: 0.12,
}

export function outputSize(
  p: Project,
  preset: ResolutionPreset,
): { width: number; height: number } {
  const { width, height } = p.settings
  if (preset === 'project') return { width, height }
  const h = Number(preset)
  const w = Math.round(((width / height) * h) / 2) * 2
  return { width: w, height: h }
}

export function outputFps(p: Project, preset: ExportOptions['fps']): Rational {
  return preset === 'project' ? p.settings.fps : { num: Number(preset), den: 1 }
}

export function estimateBitrate(o: ExportOptions, w: number, h: number, fps: Rational): number {
  if (o.quality === 'manual') return Math.max(0.2, o.bitrateMbps) * 1e6
  return Math.round(w * h * (fps.num / fps.den) * BPP[o.quality])
}

type Events = { progress: ExportProgress; state: ExportState }

export type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: number; fps: number; eta: number }
  | { kind: 'done'; seconds: number; fileName: string; bytes?: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: KaatError }

export class ExportService extends Emitter<Events> {
  state: ExportState = { kind: 'idle' }
  private abort?: AbortController
  private worker?: Worker

  constructor(private readonly caps: () => CapabilityReport | undefined) {
    super()
  }

  get running(): boolean {
    return this.state.kind === 'running'
  }

  formats(): { mp4: boolean; webm: boolean } {
    const c = this.caps()
    // MP4 means H.264 + AAC; without an AAC encoder the audio would be lost, so use WebM instead.
    return { mp4: !!c?.encode.h264 && !!c?.encode.aac, webm: !!c?.encode.vp9 }
  }

  private setState(s: ExportState): void {
    this.state = s
    telemetry.exportState = s.kind
    this.emit('state', s)
  }

  /**
   * Start an export. Call directly from a click handler: the save picker needs the user gesture,
   * so it is the first thing awaited.
   */
  async start(project: Project, files: Record<string, Blob>, o: ExportOptions): Promise<void> {
    if (this.running) return
    const caps = this.caps()
    const container: 'mp4' | 'webm' = o.format === 'mp4' && this.formats().mp4 ? 'mp4' : 'webm'
    const ext = container
    const fileName = `${o.fileName.replace(/[\\/:*?"<>|]+/g, '_') || 'export'}.${ext}`
    let fileStream: FileSystemWritableFileStream | undefined
    let tmpPath: string | undefined
    try {
      if (!o.download && window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: container.toUpperCase(),
              accept: { [container === 'mp4' ? 'video/mp4' : 'video/webm']: [`.${ext}`] },
            },
          ],
        })
        fileStream = await handle.createWritable()
      } else {
        tmpPath = `exports/${Date.now().toString(36)}.${ext}`
        const space = await ensureSpace(512 * 1024 * 1024)
        if (!space.ok)
          throw new KaatError('OUT_OF_STORAGE', 'Not enough browser storage to stage the export')
        fileStream = await opfsWritable(tmpPath)
      }
    } catch (e) {
      if (isAbort(e)) return // user closed the save dialog
      this.setState({ kind: 'error', error: toKaatError(e, 'EXPORT_FAILED') })
      return
    }

    const seq = activeSequence(project)
    const end = sequenceDuration(seq)
    const range =
      o.range === 'inout' && (seq.inPoint !== undefined || seq.outPoint !== undefined)
        ? { from: seq.inPoint ?? 0, to: seq.outPoint ?? end }
        : { from: 0, to: end }
    const { width, height } = outputSize(project, o.resolution)
    const fps = outputFps(project, o.fps)
    const audioCodec = container === 'mp4' ? 'aac' : 'opus'
    const hasAudioEncoder = container === 'mp4' ? !!caps?.encode.aac : !!caps?.encode.opus
    const job: ExportJob = {
      project,
      files,
      fonts: BUNDLED_FONTS,
      width,
      height,
      fps,
      range,
      container,
      video: {
        codec: container === 'mp4' ? 'avc' : 'vp9',
        bitrate: estimateBitrate(o, width, height, fps),
      },
      audio: hasAudioEncoder ? { codec: audioCodec, bitrate: o.audioKbps * 1000 } : null,
    }

    this.abort = new AbortController()
    const signal = this.abort.signal
    const worker = new ExportWorker({ name: 'kaat-export' })
    this.worker = worker
    const startedAt = performance.now()
    const { api } = createClient<ExportApi>(worker, (name, payload) => {
      if (name !== 'progress') return
      const p = payload as ExportProgress
      const progress = p.total ? p.frame / p.total : 0
      const elapsed = (performance.now() - startedAt) / 1000
      this.emit('progress', p)
      this.setState({
        kind: 'running',
        progress,
        fps: p.fps,
        eta: progress > 0.01 ? (elapsed / progress) * (1 - progress) : 0,
      })
    })
    this.setState({ kind: 'running', progress: 0, fps: 0, eta: 0 })

    // Positioned writes pass straight through to the file; the worker never holds the output.
    const pass = new TransformStream()
    const pipe = pass.readable.pipeTo(fileStream, { signal })
    pipe.catch(() => {})
    try {
      const result: ExportResult = await api.run(job, pass.writable, {
        signal,
        transfer: [pass.writable as unknown as Transferable],
      })
      await pipe
      if (tmpPath) await this.download(tmpPath, fileName)
      this.setState({ kind: 'done', seconds: result.seconds, fileName })
    } catch (e) {
      if (signal.aborted || isAbort(e)) {
        await fileStream.abort().catch(() => {})
        if (tmpPath) await opfsRemove(tmpPath)
        this.setState({ kind: 'cancelled' })
      } else {
        await fileStream.abort().catch(() => {})
        if (tmpPath) await opfsRemove(tmpPath)
        const err = toKaatError(e, 'EXPORT_FAILED')
        telemetry.error(err.code, err.message)
        this.setState({ kind: 'error', error: err })
      }
    } finally {
      worker.terminate()
      this.worker = undefined
      this.abort = undefined
    }
  }

  cancel(): void {
    this.abort?.abort()
  }

  reset(): void {
    if (!this.running) this.setState({ kind: 'idle' })
  }

  /** Hand a staged OPFS file to the browser's downloads. The File is disk-backed (no copy in RAM). */
  private async download(path: string, fileName: string): Promise<void> {
    const file = await opfsFile(path)
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      void opfsRemove(path)
    }, 120_000)
  }
}
