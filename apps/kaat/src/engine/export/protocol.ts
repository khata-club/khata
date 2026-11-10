import type { Project, Rational, Ticks } from '@khata/kaat-core'

import type { FontSource } from '../render/text'

export interface ExportJob {
  project: Project
  files: Record<string, Blob>
  fonts: FontSource[]
  width: number
  height: number
  fps: Rational
  range: { from: Ticks; to: Ticks }
  container: 'mp4' | 'webm'
  video: { codec: 'avc' | 'vp9'; bitrate: number }
  audio: { codec: 'aac' | 'opus'; bitrate: number } | null
}

export interface ExportResult {
  frames: number
  seconds: number
  mimeType: string
}

export interface ExportProgress {
  frame: number
  total: number
  fps: number
}

export type ExportApi = {
  run(job: ExportJob, writable: WritableStream): Promise<ExportResult>
}
