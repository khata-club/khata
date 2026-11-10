import { TAX_LIMITS, type ParentCover, type TaxSection } from './constants'

export interface TaxSectionProgress {
  section: TaxSection
  used: number
  limit: number
  remaining: number
  /** 0–100 */
  pct: number
}

/** 80D cap: self/family (25k, or 50k if senior) + parents (0, 25k or 50k). */
export function limit80D(selfSenior: boolean, parents: ParentCover): number {
  const self = selfSenior ? TAX_LIMITS['80D_senior'] : TAX_LIMITS['80D_below60']
  const par =
    parents === 'senior'
      ? TAX_LIMITS['80D_senior']
      : parents === 'below60'
        ? TAX_LIMITS['80D_below60']
        : 0
  return self + par
}

export function sectionProgress(
  section: TaxSection,
  used: number,
  limit: number,
): TaxSectionProgress {
  const capped = Math.max(0, used)
  return {
    section,
    used: capped,
    limit,
    remaining: Math.max(0, limit - capped),
    pct: limit > 0 ? Math.min(100, Math.round((capped / limit) * 100)) : 0,
  }
}

export function taxProgress(
  used: Partial<Record<TaxSection, number>>,
  opts: { selfSenior: boolean; parents: ParentCover },
): TaxSectionProgress[] {
  return [
    sectionProgress('80C', used['80C'] ?? 0, TAX_LIMITS['80C']),
    sectionProgress('80D', used['80D'] ?? 0, limit80D(opts.selfSenior, opts.parents)),
    sectionProgress('80CCD1B', used['80CCD1B'] ?? 0, TAX_LIMITS['80CCD1B']),
  ]
}
