import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { budgets, categories, categoryMix, monthlySpending } from './fixtures/finance'
import KBudgetBars from './KBudgetBars.vue'
import KColumnChart from './KColumnChart.vue'
import KDonutChart from './KDonutChart.vue'
import KStackedColumnChart from './KStackedColumnChart.vue'

// Charts/Spending stories (05–10).

describe('KColumnChart', () => {
  it('shows the last month vs the average', () => {
    const w = mount(KColumnChart, { props: monthlySpending })
    expect(w.text()).toContain('Oct 2026')
    expect(w.text()).toContain('$3,690')
    expect(w.text()).toMatch(/avg \$3\.6k/)
  })

  it('draws negative values below a zero baseline', () => {
    // Net worth with debts larger than assets used to freeze the page (ticks never ended).
    const w = mount(KColumnChart, { props: { values: [-500, -200, 300], months: ['A', 'B', 'C'] } })
    const heights = w.findAll('rect[rx="6"]').map((r) => Number(r.attributes('height')))
    expect(heights).toHaveLength(3)
    heights.forEach((h) => expect(h).toBeGreaterThan(0))
    expect(w.html()).not.toContain('NaN')
  })

  it('renders an all-zero series without hanging', () => {
    const w = mount(KColumnChart, { props: { values: [0, 0, 0], months: ['A', 'B', 'C'] } })
    expect(w.html()).not.toContain('NaN')
  })

  it('shows the empty state for no data', () => {
    const w = mount(KColumnChart, { props: { values: [], months: [] } })
    expect(w.text()).toContain('No data to show yet')
  })
})

describe('KStackedColumnChart', () => {
  it('wraps the palette past six series instead of drawing black', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    const w = mount(KStackedColumnChart, {
      props: { names, months: ['Jan'], rows: [[1, 1, 1, 1, 1, 1, 1]] },
    })
    const fills = w.findAll('rect[rx="3"]').map((r) => r.attributes('fill'))
    expect(fills).toHaveLength(7)
    expect(fills.every(Boolean)).toBe(true)
    expect(fills[6]).toBe(fills[0])
  })

  it('never draws a negative segment height', () => {
    const w = mount(KStackedColumnChart, { props: { ...categoryMix, rows: [[1850, 0, 1, 380]] } })
    for (const r of w.findAll('rect[rx="3"]')) {
      expect(Number(r.attributes('height'))).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('KDonutChart', () => {
  it('totals the categories and lists them with shares', () => {
    const w = mount(KDonutChart, { props: { items: categories, centerLabel: 'October' } })
    expect(w.text()).toContain('$3,960')
    expect(w.findAll('li')).toHaveLength(6)
    expect(w.text()).toContain('47%')
  })

  it('shows the empty state when everything is zero', () => {
    const w = mount(KDonutChart, { props: { items: [{ label: 'Food', value: 0 }] } })
    expect(w.text()).toContain('No data to show yet')
  })
})

describe('KBudgetBars', () => {
  it('flags over-budget rows and exposes meters', () => {
    const w = mount(KBudgetBars, { props: { items: budgets } })
    expect(w.findAll('[role="meter"]')).toHaveLength(6)
    expect(w.text()).toContain('$62 over budget')
    expect(w.text()).toContain('$80 left')
  })
})
