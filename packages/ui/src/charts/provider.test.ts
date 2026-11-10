import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { categoryMix, monthlySpending } from './fixtures/finance'
import KChartProvider from './KChartProvider.vue'
import KColumnChart from './KColumnChart.vue'
import KStackedColumnChart from './KStackedColumnChart.vue'
import { PALETTES } from './lib/palette'

const gridOpacities = (html: string) =>
  [...html.matchAll(/class="stroke-line" stroke-opacity="(\d)"/g)].map((m) => m[1])

describe('KChartProvider', () => {
  it('applies the monochrome palette to descendants', async () => {
    // Series colour 1 differs between palettes (colour 0 is brand blue in both).
    const mono = PALETTES.Monochrome.series[1]!
    const w = mount({
      components: { KChartProvider, KStackedColumnChart },
      data: () => ({ p: 'Calm', props: categoryMix }),
      template: `<KChartProvider :palette="p"><KStackedColumnChart v-bind="props" /></KChartProvider>`,
    })
    expect(w.find('article').attributes('style')).toContain('--k: 1')
    expect(w.html()).not.toContain(mono)
    await w.setData({ p: 'Monochrome' })
    await nextTick()
    expect(w.html()).toContain(mono)
  })

  it('shows grid lines by default', () => {
    // An absent Boolean prop is cast to false by Vue, which used to hide every grid.
    const w = mount(KColumnChart, { props: monthlySpending })
    const ops = gridOpacities(w.html())
    expect(ops.length).toBeGreaterThan(0)
    expect(ops.every((o) => o === '1')).toBe(true)
  })

  it('lets the provider hide grids, and a chart prop override the provider', () => {
    const w = mount({
      components: { KChartProvider, KColumnChart },
      data: () => ({ props: monthlySpending }),
      template: `<KChartProvider :show-grid="false">
        <KColumnChart v-bind="props" />
        <KColumnChart v-bind="props" show-grid />
      </KChartProvider>`,
    })
    const [first, second] = w.findAll('article').map((a) => gridOpacities(a.html()))
    expect(first!.every((o) => o === '0')).toBe(true)
    expect(second!.every((o) => o === '1')).toBe(true)
  })
})
