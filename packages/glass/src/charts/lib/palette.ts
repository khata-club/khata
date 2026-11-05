export type ChartPalette = 'System' | 'Monochrome'

/**
 * Categorical series colours as theme variables, so every chart follows light/dark without
 * re-rendering. Index 0 is always the accent; the last is the neutral "other".
 * INK is the readable label colour on top of each series colour (treemap tiles).
 */
export const PALETTES: Record<ChartPalette, { series: string[]; ink: string[] }> = {
  System: {
    series: [1, 2, 3, 4, 5, 6, 7].map((i) => `var(--color-series-${i})`),
    ink: ['#fff', '#1d1d1f', '#1d1d1f', '#1d1d1f', '#fff', '#1d1d1f', '#1d1d1f'],
  },
  Monochrome: {
    series: [
      'var(--color-series-1)',
      'color-mix(in srgb, var(--color-series-1) 72%, var(--color-surface))',
      'color-mix(in srgb, var(--color-series-1) 48%, var(--color-surface))',
      'color-mix(in srgb, var(--color-series-1) 28%, var(--color-surface))',
      'var(--color-indigo)',
      'var(--color-series-7)',
    ],
    ink: ['#fff', '#fff', '#1d1d1f', '#1d1d1f', '#fff', '#1d1d1f'],
  },
}

/** Fixed chart colours shared across palettes (all theme-aware). */
export const CHART = {
  primary: 'var(--color-series-1)',
  primaryDeep: 'var(--color-indigo)',
  light: 'color-mix(in srgb, var(--color-series-1) 32%, transparent)',
  good: 'var(--color-green)',
  bad: 'var(--color-red)',
  ink: 'var(--color-label)',
  grid: 'var(--color-separator)',
  muted: 'var(--color-label-secondary)',
  accent: 'var(--color-series-1)',
  track: 'var(--color-fill-tertiary)',
  surface: 'var(--color-surface)',
} as const
