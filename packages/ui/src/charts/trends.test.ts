import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { assetMix, netWorth } from './fixtures/finance'
import KAreaChart from './KAreaChart.vue'
import KSparklineGrid from './KSparklineGrid.vue'
import KStackedAreaChart from './KStackedAreaChart.vue'

// Charts/Trends stories (01–04).

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

  it('handles a flat series that starts at zero', () => {
    const w = mount(KAreaChart, { props: { values: [0, 0, 0], end: new Date(2026, 0, 1) } })
    expect(w.html()).not.toContain('NaN')
    expect(w.html()).not.toContain('Infinity')
  })
})

describe('KSparklineGrid', () => {
  it('measures change against |first| so −100 → +100 reads as a rise', () => {
    const w = mount(KSparklineGrid, {
      props: { accounts: [{ name: 'Wallet', values: [-100, 100] }] },
    })
    expect(w.text()).toContain('+200.0%')
  })
})

describe('KStackedAreaChart', () => {
  it('labels every 6 months plus the last', () => {
    const w = mount(KStackedAreaChart, { props: assetMix })
    const labels = w.findAll('text').map((t) => t.text())
    expect(labels).toEqual(
      expect.arrayContaining(['Nov ’24', 'May ’25', 'Nov ’25', 'May ’26', 'Oct ’26']),
    )
  })

  it('shows the empty state for fewer than two points', () => {
    const w = mount(KStackedAreaChart, { props: { ...assetMix, rows: [] } })
    expect(w.text()).toContain('No data to show yet')
  })
})
