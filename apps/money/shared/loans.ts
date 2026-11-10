/** EMI and amortization maths (reducing-balance, monthly compounding). Amounts in paise. */

/** Monthly EMI for a principal at an annual rate (percent) over `months`. */
export function emi(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0
  const r = annualRatePct / 12 / 100
  if (r === 0) return Math.round(principal / months)
  const f = Math.pow(1 + r, months)
  return Math.round((principal * r * f) / (f - 1))
}

export interface AmortizationRow {
  month: number
  interest: number
  principal: number
  balance: number
}

export function amortization(
  principal: number,
  annualRatePct: number,
  months: number,
): AmortizationRow[] {
  const pay = emi(principal, annualRatePct, months)
  const r = annualRatePct / 12 / 100
  let bal = principal
  const rows: AmortizationRow[] = []
  for (let i = 1; i <= months && bal > 0; i++) {
    const interest = Math.round(bal * r)
    const p = i === months ? bal : Math.min(bal, pay - interest)
    bal -= p
    rows.push({ month: i, interest, principal: p, balance: bal })
  }
  return rows
}

/** Principal still owed after `paid` EMIs. */
export function outstandingAfter(
  principal: number,
  annualRatePct: number,
  months: number,
  paid: number,
): number {
  if (paid <= 0) return principal
  const rows = amortization(principal, annualRatePct, months)
  return rows[Math.min(paid, rows.length) - 1]?.balance ?? 0
}

/** Total interest over the life of the loan. */
export function totalInterest(principal: number, annualRatePct: number, months: number): number {
  return amortization(principal, annualRatePct, months).reduce((a, r) => a + r.interest, 0)
}
