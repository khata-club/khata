import { createProject } from '@khata/kaat-core'
import { describe, expect, it } from 'vitest'

import { estimateBitrate, outputFps, outputSize } from './export/exportService'
import { guessKind } from './editor'
import { sameBlob } from './media/inputs'
import { parseColor } from './render/compositor'
import { textCacheKey, textRasterScale } from './render/text'
import { fingerprint } from './sources'
import { Ring } from './telemetry'

describe('telemetry ring', () => {
  it('keeps a bounded window and reports percentiles', () => {
    const r = new Ring(10)
    for (let i = 1; i <= 100; i++) r.push(i)
    expect(r.count).toBe(10)
    expect(r.percentile(50)).toBe(96)
    expect(r.mean()).toBeCloseTo(95.5)
  })
})

describe('file identity', () => {
  it('treats cloned files with the same identity as the same file', () => {
    const a = new File(['abc'], 'a.mp4', { type: 'video/mp4', lastModified: 5 })
    const b = new File(['abc'], 'a.mp4', { type: 'video/mp4', lastModified: 5 })
    const c = new File(['abc'], 'a.mp4', { type: 'video/mp4', lastModified: 6 })
    expect(sameBlob(a, b)).toBe(true)
    expect(sameBlob(a, c)).toBe(false)
    expect(fingerprint('a', 1, 2)).toBe(fingerprint('a', 1, 2))
    expect(fingerprint('a', 1, 2)).not.toBe(fingerprint('a', 1, 3))
  })

  it('guesses media kinds from type or extension', () => {
    expect(guessKind(new File([], 'x.MOV'))).toBe('video')
    expect(guessKind(new File([], 'x', { type: 'audio/wav' }))).toBe('audio')
    expect(guessKind(new File([], 'x.jpeg'))).toBe('image')
    expect(guessKind(new File([], 'x.txt'))).toBeUndefined()
  })
})

describe('rendering helpers', () => {
  it('parses colours', () => {
    expect(parseColor('#ff0000')).toEqual([1, 0, 0, 1])
    expect(parseColor('#0f0', 0.5)).toEqual([0, 1, 0, 0.5])
  })

  it('buckets text raster scale so animated scale does not re-rasterise every frame', () => {
    expect(textRasterScale(0.3)).toBe(0.5)
    expect(textRasterScale(0.9)).toBe(1)
    expect(textRasterScale(9)).toBe(4)
    const t = {
      content: 'a',
      fontFamily: 'Quicksand',
      fontSize: 10,
      fontWeight: 700,
      align: 'center' as const,
      color: '#fff',
    }
    expect(textCacheKey(t, 1)).not.toBe(textCacheKey({ ...t, content: 'b' }, 1))
  })
})

describe('export presets', () => {
  const p = createProject('x', { width: 1920, height: 1080 })
  it('keeps the project aspect ratio for resolution presets', () => {
    expect(outputSize(p, '720')).toEqual({ width: 1280, height: 720 })
    expect(outputSize(p, 'project')).toEqual({ width: 1920, height: 1080 })
  })

  it('derives bitrate from quality, size and frame rate', () => {
    const o = { quality: 'high', bitrateMbps: 5 } as const
    const fps = outputFps(p, '30')
    const hi = estimateBitrate({ ...o } as never, 1920, 1080, fps)
    const lo = estimateBitrate({ ...o, quality: 'low' } as never, 1920, 1080, fps)
    expect(hi).toBeGreaterThan(lo)
    expect(estimateBitrate({ ...o, quality: 'manual' } as never, 1920, 1080, fps)).toBe(5e6)
  })
})
