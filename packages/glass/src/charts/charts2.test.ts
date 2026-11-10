import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { assetMix, goals, incomeFlow, incomeToSavings, portfolio } from './fixtures/finance'
import GAmortizationChart from './GAmortizationChart.vue'
import GFanChart from './GFanChart.vue'
import GGauge from './GGauge.vue'
import GProgressRings from './GProgressRings.vue'
import GSankeyChart from './GSankeyChart.vue'
import GStackedAreaChart from './GStackedAreaChart.vue'
import GTreemap from './GTreemap.vue'
import GWaterfallChart from './GWaterfallChart.vue'

describe('charts 11–20', () => {
  it('GSankeyChart labels every node with value and share', () => {
    const w = mount(GSankeyChart, { props: incomeFlow })
    expect(w.text()).toContain('Housing')
    expect(w.text()).toContain('$1,850 · 30%')
    expect(w.findAll('path')).toHaveLength(incomeFlow.sources.length + incomeFlow.targets.length)
  })

  it('GWaterfallChart ends at the saved total', () => {
    const w = mount(GWaterfallChart, { props: { steps: incomeToSavings } })
    expect(w.text()).toContain('$2,500')
    expect(w.text()).toContain('40% of income')
  })

  it('GGauge names the active band', () => {
    const w = mount(GGauge, { props: { value: 742 } })
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Very good')
  })

  it('GProgressRings shows each goal percentage', () => {
    const w = mount(GProgressRings, { props: { goals } })
    expect(w.text()).toContain('82%')
    expect(w.text()).toContain('23%')
  })

  it('GTreemap totals tiles and uses fixed or squarified placement', () => {
    const fixed = mount(GTreemap, { props: { tiles: portfolio } })
    expect(fixed.text()).toContain('$186,400')
    expect(fixed.find('li').attributes('style')).toContain('width: 48%')
    const auto = mount(GTreemap, {
      props: { tiles: portfolio.map((t) => ({ ...t, rect: undefined })) },
    })
    expect(auto.findAll('li')).toHaveLength(6)
  })

  it('GFanChart recomputes the median per contribution', async () => {
    const w = mount(GFanChart, { props: { contribution: 1000 } })
    expect(w.text()).toContain('$2,005,446')
    await w.setProps({ contribution: 2000 })
    expect(w.text()).not.toContain('$2,005,446')
  })

  it('GAmortizationChart totals interest for the loan', () => {
    const w = mount(GAmortizationChart)
    expect(w.text()).toContain('$510,964 interest')
    expect(w.text()).toContain('$2,586/mo')
  })

  it('GStackedAreaChart labels every 6 months plus the last', () => {
    const w = mount(GStackedAreaChart, { props: assetMix })
    const labels = w.findAll('text').map((t) => t.text())
    expect(labels).toEqual(
      expect.arrayContaining(['Nov ’24', 'May ’25', 'Nov ’25', 'May ’26', 'Oct ’26']),
    )
  })
})
