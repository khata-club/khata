import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { mortgage, portfolio, retirement } from './fixtures/finance'
import KAmortizationChart from './KAmortizationChart.vue'
import KFanChart from './KFanChart.vue'
import KTreemap from './KTreemap.vue'

// Charts/Investing & planning stories (17–20).

describe('KTreemap', () => {
  it('totals tiles and uses fixed or squarified placement', () => {
    const fixed = mount(KTreemap, { props: { tiles: portfolio } })
    expect(fixed.text()).toContain('$186,400')
    expect(fixed.find('li').attributes('style')).toContain('width: 48%')
    const auto = mount(KTreemap, {
      props: { tiles: portfolio.map((t) => ({ ...t, rect: undefined })) },
    })
    expect(auto.findAll('li')).toHaveLength(6)
  })
})

describe('KFanChart', () => {
  it('recomputes the median per contribution', async () => {
    const w = mount(KFanChart, { props: { ...retirement, contribution: 1000 } })
    expect(w.text()).toContain('$2,005,446')
    await w.setProps({ contribution: 2000 })
    expect(w.text()).not.toContain('$2,005,446')
  })

  it('projects plain savings when growth is 0%', () => {
    const w = mount(KFanChart, { props: { ...retirement, growth: 0, contribution: 1000 } })
    // 86,940 + 1,000 × 12 × 35 years
    expect(w.text()).toContain('$506,940')
    expect(w.html()).not.toContain('NaN')
  })
})

describe('KAmortizationChart', () => {
  it('totals interest for the loan', () => {
    const w = mount(KAmortizationChart, { props: mortgage })
    expect(w.text()).toContain('$510,964 interest')
    expect(w.text()).toContain('$2,586/mo')
  })

  it('splits an interest-free loan into equal payments', () => {
    const w = mount(KAmortizationChart, { props: { ...mortgage, rate: 0 } })
    expect(w.text()).toContain('$0 interest')
    expect(w.text()).toContain('$1,167/mo')
    expect(w.html()).not.toContain('NaN')
  })

  it('labels a one-year loan once', () => {
    const w = mount(KAmortizationChart, { props: { ...mortgage, years: 1 } })
    const labels = w.findAll('text').map((t) => t.text())
    expect(labels.filter((l) => l.startsWith('Yr '))).toEqual(['Yr 1'])
  })
})
