import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { assetMix, goals, incomeFlow, incomeToSavings, portfolio } from './fixtures/finance'
import KAmortizationChart from './KAmortizationChart.vue'
import KFanChart from './KFanChart.vue'
import KGauge from './KGauge.vue'
import KProgressRings from './KProgressRings.vue'
import KSankeyChart from './KSankeyChart.vue'
import KStackedAreaChart from './KStackedAreaChart.vue'
import KTreemap from './KTreemap.vue'
import KWaterfallChart from './KWaterfallChart.vue'

describe('charts 11–20', () => {
  it('KSankeyChart labels every node with value and share', () => {
    const w = mount(KSankeyChart, { props: incomeFlow })
    expect(w.text()).toContain('Housing')
    expect(w.text()).toContain('$1,850 · 30%')
    expect(w.findAll('path')).toHaveLength(incomeFlow.sources.length + incomeFlow.targets.length)
  })

  it('KWaterfallChart ends at the saved total', () => {
    const w = mount(KWaterfallChart, { props: { steps: incomeToSavings } })
    expect(w.text()).toContain('$2,500')
    expect(w.text()).toContain('40% of income')
  })

  it('KGauge names the active band', () => {
    const w = mount(KGauge, { props: { value: 742 } })
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Very good')
  })

  it('KProgressRings shows each goal percentage', () => {
    const w = mount(KProgressRings, { props: { goals } })
    expect(w.text()).toContain('82%')
    expect(w.text()).toContain('23%')
  })

  it('KTreemap totals tiles and uses fixed or squarified placement', () => {
    const fixed = mount(KTreemap, { props: { tiles: portfolio } })
    expect(fixed.text()).toContain('$186,400')
    expect(fixed.find('li').attributes('style')).toContain('width: 48%')
    const auto = mount(KTreemap, {
      props: { tiles: portfolio.map((t) => ({ ...t, rect: undefined })) },
    })
    expect(auto.findAll('li')).toHaveLength(6)
  })

  it('KFanChart recomputes the median per contribution', async () => {
    const w = mount(KFanChart, { props: { contribution: 1000 } })
    expect(w.text()).toContain('$2,005,446')
    await w.setProps({ contribution: 2000 })
    expect(w.text()).not.toContain('$2,005,446')
  })

  it('KAmortizationChart totals interest for the loan', () => {
    const w = mount(KAmortizationChart)
    expect(w.text()).toContain('$510,964 interest')
    expect(w.text()).toContain('$2,586/mo')
  })

  it('KStackedAreaChart labels every 6 months plus the last', () => {
    const w = mount(KStackedAreaChart, { props: assetMix })
    const labels = w.findAll('text').map((t) => t.text())
    expect(labels).toEqual(
      expect.arrayContaining(['Nov ’24', 'May ’25', 'Nov ’25', 'May ’26', 'Oct ’26']),
    )
  })
})
