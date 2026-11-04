/** Colour helpers for luminance-aware components (credit card ink, emboss and sheen). */

export type RGB = [number, number, number]

/** Parse #rgb / #rrggbb (with or without #). Returns `null` for anything else. */
export function parseHex(hex: string): RGB | null {
  let h = String(hex || '')
    .trim()
    .replace(/^#/, '')
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
}

export const toHex = (rgb: RGB) =>
  '#' +
  rgb
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

/** WCAG relative luminance. */
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }) as RGB
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two luminances. */
export const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** Mix `rgb` toward the grey level `target` (0–255) by `a` (0–1). */
export const mixToward = (rgb: RGB, target: number, a: number): RGB =>
  rgb.map((v) => Math.round(v * (1 - a) + target * a)) as RGB

/**
 * Ink for text on `rgb`: picks near-black or white (whichever contrasts more), then the faintest
 * tint of the background toward it that still clears `need` (e.g. 7 for primary text, 4.5 for
 * muted labels).
 */
export function inkOn(rgb: RGB, need: number, from = 0.55) {
  const L = luminance(rgb)
  const light = contrast(L, luminance([20, 20, 20])) > contrast(L, 1)
  const t = light ? 20 : 255
  let a = from
  for (; a < 1; a += 0.02) if (contrast(L, luminance(mixToward(rgb, t, a))) >= need) break
  const ink = mixToward(rgb, t, Math.min(a, 1))
  return { light, ink, ratio: contrast(L, luminance(ink)) }
}
