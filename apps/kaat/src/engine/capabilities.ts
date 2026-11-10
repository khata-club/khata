/**
 * Chrome capability gate (EPIC 1). Kaat targets the latest desktop Chrome; this checks the APIs the
 * engine depends on and the codecs it can decode/encode on this machine.
 */
export interface CapabilityReport {
  ok: boolean
  missing: string[]
  warnings: string[]
  features: Record<string, boolean>
  encode: { h264: boolean; aac: boolean; vp9: boolean; opus: boolean }
  decode: { h264: boolean; hevc: boolean; vp9: boolean; av1: boolean }
  hardwareConcurrency: number
  deviceMemory?: number
}

async function videoDecodable(codec: string): Promise<boolean> {
  try {
    const r = await VideoDecoder.isConfigSupported({ codec, codedWidth: 1920, codedHeight: 1080 })
    return !!r.supported
  } catch {
    return false
  }
}

async function videoEncodable(codec: string): Promise<boolean> {
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec,
      width: 1920,
      height: 1080,
      bitrate: 8e6,
      framerate: 30,
    })
    return !!r.supported
  } catch {
    return false
  }
}

async function audioEncodable(codec: string): Promise<boolean> {
  try {
    const r = await AudioEncoder.isConfigSupported({
      codec,
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    })
    return !!r.supported
  } catch {
    return false
  }
}

export async function checkCapabilities(): Promise<CapabilityReport> {
  const g = globalThis as Record<string, unknown>
  const features: Record<string, boolean> = {
    WebCodecs:
      typeof g.VideoDecoder === 'function' &&
      typeof g.VideoEncoder === 'function' &&
      typeof g.AudioDecoder === 'function',
    OffscreenCanvas:
      typeof g.OffscreenCanvas === 'function' &&
      'transferControlToOffscreen' in HTMLCanvasElement.prototype,
    WebGL2: (() => {
      try {
        return !!new OffscreenCanvas(1, 1).getContext('webgl2')
      } catch {
        return false
      }
    })(),
    Workers: typeof g.Worker === 'function',
    WebAudio: typeof g.AudioContext === 'function',
    IndexedDB: typeof g.indexedDB === 'object',
    OPFS: !!navigator.storage?.getDirectory,
    FileSystemAccess: typeof (window as Window).showOpenFilePicker === 'function',
    ServiceWorker: 'serviceWorker' in navigator,
  }
  const required = [
    'WebCodecs',
    'OffscreenCanvas',
    'WebGL2',
    'Workers',
    'WebAudio',
    'IndexedDB',
    'OPFS',
  ]
  const missing = required.filter((k) => !features[k])
  const warnings: string[] = []
  if (!features.FileSystemAccess)
    warnings.push(
      'File System Access is unavailable: media must be relinked after a reload, and exports download instead of saving in place.',
    )
  const [h264, hevc, vp9, av1, eh264, evp9, aac, opus] = features.WebCodecs
    ? await Promise.all([
        videoDecodable('avc1.640028'),
        videoDecodable('hev1.1.6.L120.90'),
        videoDecodable('vp09.00.40.08'),
        videoDecodable('av01.0.08M.08'),
        videoEncodable('avc1.640028'),
        videoEncodable('vp09.00.40.08'),
        audioEncodable('mp4a.40.2'),
        audioEncodable('opus'),
      ])
    : [false, false, false, false, false, false, false, false]
  if (features.WebCodecs && !eh264)
    warnings.push('H.264 encoding is unavailable here; exports use WebM (VP9/Opus).')
  return {
    ok: missing.length === 0,
    missing,
    warnings,
    features,
    encode: { h264: eh264, aac, vp9: evp9, opus },
    decode: { h264, hevc, vp9, av1 },
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  }
}
