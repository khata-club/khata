import type { BudgetItem, DonutItem } from '@khata/ui'

import { formatMonth } from '#shared/dates'
import type { Budget, Category, MonthSummary, TrendPoint } from '#shared/types'

/** Kit charts take rupees; the API speaks paise. */
export const rupees = (paise: number) => Math.round(paise / 100)

/** Top categories for a donut, folding the tail into "Other". */
export function donutItems(
  rows: MonthSummary['byCategory'],
  cats: Map<string, Category>,
  max = 6,
): DonutItem[] {
  const named = rows.map((r) => ({
    label: cats.get(r.categoryId ?? '')?.name ?? 'Uncategorised',
    value: rupees(r.amount),
  }))
  if (named.length <= max) return named
  const head = named.slice(0, max - 1)
  const tail = named.slice(max - 1).reduce((a, r) => a + r.value, 0)
  return [...head, { label: 'Everything else', value: tail }]
}

export function budgetItems(budgets: Budget[], cats: Map<string, Category>): BudgetItem[] {
  return budgets
    .map((b) => ({
      name: cats.get(b.categoryId)?.name ?? 'Category',
      spent: rupees(b.spent),
      budget: rupees(b.limit),
    }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
}

export function trendSeries(points: TrendPoint[]) {
  return {
    months: points.map((p) => formatMonth(p.month, { short: true })),
    income: points.map((p) => rupees(p.income)),
    expenses: points.map((p) => rupees(p.expense)),
  }
}
