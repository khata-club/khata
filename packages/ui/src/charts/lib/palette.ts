export type ChartPalette = 'Calm' | 'Monochrome'

/**
 * Categorical series colours. Index 0 is always brand blue; index 5 is the neutral "other".
 * INK is the readable text colour on top of each series colour (treemap tiles).
 */
export const PALETTES: Record<ChartPalette, { series: string[]; ink: string[] }> = {
  Calm: {
    series: [
      '#2457D6',
      'oklch(0.72 0.09 205)',
      'oklch(0.82 0.10 80)',
      'oklch(0.70 0.12 28)',
      'oklch(0.56 0.10 300)',
      '#94A3BB',
    ],
    ink: ['#fff', '#0F1B2D', '#0F1B2D', '#0F1B2D', '#fff', '#0F1B2D'],
  },
  Monochrome: {
    series: ['#2457D6', '#5A80E6', '#86A3EE', '#AFC3F6', '#3A4E78', '#94A3BB'],
    ink: ['#fff', '#fff', '#0F1B2D', '#0F1B2D', '#fff', '#0F1B2D'],
  },
}

/** Fixed chart colours shared across palettes. */
export const CHART = {
  primary: '#2457D6',
  primaryDeep: '#1D45AC',
  light: '#C9D7FA',
  good: '#137744',
  bad: '#C42B37',
  ink: '#0F1B2D',
  grid: '#E8ECF3',
  muted: '#7A89A2',
  accent: '#93B6FF',
  track: '#F4F6FA',
} as const
