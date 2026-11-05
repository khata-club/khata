export interface DateRangePreset {
  value: string
  label: string
  days: number
}

export const DEFAULT_PRESETS: DateRangePreset[] = [
  { value: '1d', label: '24h', days: 1 },
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
]

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Inclusive range ending on `todayIso` covering `days` calendar days (UTC). */
export function presetRange(days: number, todayIso: string): { from: string; to: string } {
  const end = new Date(`${todayIso}T00:00:00Z`)
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - (days - 1))
  return { from: isoDate(start), to: isoDate(end) }
}
