import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { budgets, categories, monthlySpending, netWorth } from './fixtures/finance'
import KAreaChart from './KAreaChart.vue'
import KBudgetBars from './KBudgetBars.vue'
import KChartProvider from './KChartProvider.vue'
import KColumnChart from './KColumnChart.vue'
import KDonutChart from './KDonutChart.vue'

// jsdom has no IntersectionObserver, so charts reveal immediately.

describe('KAreaChart', () => {
  it('reports the latest value and re-computes the delta per range', async () => {
    const w = mount(KAreaChart, { props: { ...netWorth, range: '1Y' } })
    expect(w.text()).toContain('Today')
    expect(w.text()).toContain('over 1Y')
    const d1 = w.find('path[pathLength="1"]').attributes('d')
    await w.setProps({ range: '5Y' })
    expect(w.text()).toContain('over 5Y')
    expect(w.find('path[pathLength="1"]').attributes('d')).not.toBe(d1)
  })

  it('emits range updates from the segmented control', async () => {
    const w = mount(KAreaChart, { props: netWorth, attachTo: document.body })
    await w.findAll('[role="radio"]')[0]!.trigger('click')
    expect(w.emitted('update:range')?.[0]).toEqual(['6M'])
    w.unmount()
  })
})

describe('KColumnChart', () => {
  it('shows the last month vs the average', () => {
    const w = mount(KColumnChart, { props: monthlySpending })
    expect(w.text()).toContain('Oct 2026')
    expect(w.text()).toContain('$3,690')
    expect(w.text()).toMatch(/avg \$3\.6k/)
  })
})

describe('KDonutChart', () => {
  it('totals the categories and lists them with shares', () => {
    const w = mount(KDonutChart, { props: { items: categories, centerLabel: 'October' } })
    expect(w.text()).toContain('$3,960')
    expect(w.findAll('li')).toHaveLength(6)
    expect(w.text()).toContain('47%')
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

describe('KChartProvider', () => {
  it('applies the monochrome palette to descendants', async () => {
    const w = mount({
      components: { KChartProvider, KColumnChart },
      data: () => ({ p: 'Calm', props: monthlySpending }),
      template: `<KChartProvider :palette="p"><KColumnChart v-bind="props" /></KChartProvider>`,
    })
    expect(w.find('article').attributes('style')).toContain('--k: 1')
    await w.setData({ p: 'Monochrome' })
    await nextTick()
    expect(w.html()).toContain('#2457D6')
  })
})
