/**
 * Text layer rasterisation, used identically by preview and export. Text is drawn with a 2D
 * OffscreenCanvas at a bucketed raster scale (so animated scale doesn't re-rasterise every frame)
 * and uploaded as a texture.
 */
import type { TextProps } from '@khata/kaat-core'

export const TEXT_FONTS = [
  'Quicksand',
  'Geist Mono',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Impact',
] as const

export function textRasterScale(effective: number): number {
  const buckets = [0.25, 0.5, 1, 2, 4]
  for (const b of buckets) if (effective <= b) return b
  return 4
}

export function textCacheKey(t: TextProps, rs: number): string {
  return `text:${rs}:${t.fontFamily}:${t.fontWeight}:${t.fontSize}:${t.align}:${t.color}:${t.content}`
}

export function fontString(t: TextProps, rs: number): string {
  const family = t.fontFamily.includes(' ') ? `"${t.fontFamily}"` : t.fontFamily
  return `${t.fontWeight} ${t.fontSize * rs}px ${family}, sans-serif`
}

export function rasterizeText(
  t: TextProps,
  rs: number,
): { canvas: OffscreenCanvas; width: number; height: number } {
  const lines = t.content.split('\n')
  const measureCanvas = new OffscreenCanvas(1, 1)
  const m = measureCanvas.getContext('2d')!
  m.font = fontString(t, rs)
  const lh = t.fontSize * 1.2 * rs
  const pad = Math.ceil(t.fontSize * 0.2 * rs)
  let maxW = 1
  for (const l of lines) maxW = Math.max(maxW, m.measureText(l).width)
  const width = Math.min(8192, Math.ceil(maxW + pad * 2))
  const height = Math.min(8192, Math.ceil(lines.length * lh + pad * 2))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.font = fontString(t, rs)
  ctx.fillStyle = t.color
  ctx.textBaseline = 'middle'
  ctx.textAlign = t.align
  const x = t.align === 'left' ? pad : t.align === 'right' ? width - pad : width / 2
  lines.forEach((l, i) => ctx.fillText(l, x, pad + lh * (i + 0.5)))
  return { canvas, width, height }
}

export interface FontSource {
  family: string
  weight: string
  url: string
}

/** Load bundled fonts into a worker (or window) so canvases can use them. */
export async function loadFonts(fonts: FontSource[]): Promise<void> {
  const set = (self as unknown as { fonts: FontFaceSet }).fonts
  await Promise.all(
    fonts.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight })
        await face.load()
        set.add(face)
      } catch {
        // A missing font falls back to sans-serif; preview and export still match.
      }
    }),
  )
}
