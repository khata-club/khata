/** Types shared by the media worker and its main-thread service. */
export interface ProbeResult {
  kind: 'video' | 'audio' | 'image'
  durationSeconds: number
  /** First timestamp in the file; source time 0 maps here. */
  startSeconds: number
  width: number
  height: number
  fps?: number
  hasVideo: boolean
  hasAudio: boolean
  sampleRate?: number
  channels?: number
  videoCodec?: string
  audioCodec?: string
  /** Codec present but not decodable in this browser. */
  undecodable?: string
}

export interface Pcm {
  sampleRate: number
  startSeconds: number
  channels: Float32Array[]
}

export interface WaveformChunk {
  key: string
  /** Index of the first peak in this chunk. */
  offset: number
  /** Interleaved min/max per peak, scaled to int8. */
  data: Int8Array
  done: boolean
  peaksPerSecond: number
}

export type MediaApi = {
  probe(file: File, name: string): Promise<ProbeResult>
  thumbnails(
    key: string,
    file: Blob,
    times: number[],
    height: number,
  ): Promise<(ImageBitmap | null)[]>
  waveform(key: string, file: Blob, peaksPerSecond: number): Promise<number>
  pcm(key: string, file: Blob, startSeconds: number, endSeconds: number): Promise<Pcm | null>
  buildProxy(key: string, file: Blob, path: string, codec: 'avc' | 'vp9'): Promise<number>
  decodeBenchmark(key: string, file: Blob, seconds: number): Promise<number>
  release(key: string): Promise<void>
}
