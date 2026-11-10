import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { incomeFlow, incomeToSavings, netCashFlow } from './fixtures/finance'
import KDivergingColumnChart from './KDivergingColumnChart.vue'
import KSankeyChart from './KSankeyChart.vue'
import KWaterfallChart from './KWaterfallChart.vue'
import { CHART } from './lib/palette'

// Charts/Flow stories (11–13). jsdom has no IntersectionObserver, so charts reveal immediately.

describe('KSankeyChart', () => {
  it('labels every node with value and share', () => {
    const w = mount(KSankeyChart, { props: incomeFlow })
    expect(w.text()).toContain('Housing')
    expect(w.text()).toContain('$1,850 · 30%')
    expect(w.findAll('path')).toHaveLength(incomeFlow.sources.length + incomeFlow.targets.length)
  })

  it('shows the empty state instead of NaN geometry when nothing flows', () => {
    const w = mount(KSankeyChart, {
      props: { sources: [{ label: 'Salary', value: 0 }], targets: [{ label: 'Rent', value: 0 }] },
    })
    expect(w.text()).toContain('No data to show yet')
    expect(w.html()).not.toContain('NaN')
  })
})

describe('KWaterfallChart', () => {
  it('ends at the saved total', () => {
    const w = mount(KWaterfallChart, { props: { steps: incomeToSavings } })
    expect(w.text()).toContain('$2,500')
    expect(w.text()).toContain('40% of income')
  })

  it('shows a deficit in the danger colour and keeps every bar inside the plot', () => {
    const steps = [
      { label: 'Income', value: 1000 },
      { label: 'Rent', value: -1500 },
    ]
    const w = mount(KWaterfallChart, { props: { steps } })
    expect(w.text()).toContain('−$500')
    const rects = w.findAll('rect[rx="5"]')
    expect(rects.at(-1)!.attributes('fill')).toBe(CHART.bad)
    for (const r of rects) expect(Number(r.attributes('height'))).toBeGreaterThanOrEqual(0)
    expect(w.html()).not.toContain('NaN')
  })
})

describe('KDivergingColumnChart', () => {
  it('names the chart by its data, not by the hovered bar', () => {
    const w = mount(KDivergingColumnChart, { props: netCashFlow })
    expect(w.get('svg[role="img"]').attributes('aria-label')).toMatch(/net \$\d.* over 12 months/)
  })
})
