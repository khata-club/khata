import type { ArgTypes } from '@storybook/vue3-vite'
import type { Component } from 'vue'

import KButton from '../../components/KButton.vue'
import KChartProvider from '../KChartProvider.vue'
import type { ChartPalette } from '../lib/palette'

/** The prototype's chart "Tweaks", as Storybook controls. */
export interface ChartControls {
  palette: ChartPalette
  animationSpeed: number
  showGrid: boolean
}

export const chartArgTypes: ArgTypes<ChartControls> = {
  palette: {
    control: 'inline-radio',
    options: ['Calm', 'Monochrome'],
    table: { category: 'Charts' },
  },
  animationSpeed: {
    control: { type: 'range', min: 0.5, max: 2, step: 0.25 },
    table: { category: 'Charts' },
  },
  showGrid: { control: 'boolean', table: { category: 'Charts' } },
}
export const chartArgs: ChartControls = { palette: 'Calm', animationSpeed: 1, showGrid: true }

/** Header descriptors from the prototype, by chart number (charts have no default `kind`). */
export const CHART_KINDS: Record<string, string> = {
  '01.': 'Area · range morph · crosshair',
  '02.': 'Sparkline · 30 days',
  '03.': 'Candlestick + volume',
  '04.': '100% stacked area',
  '05.': 'Column · average line',
  '06.': 'Grouped column',
  '07.': 'Donut',
  '08.': 'Stacked column',
  '10.': 'Bullet bar · limit marker',
  '11.': 'Sankey · hover a flow',
  '12.': 'Waterfall',
  '13.': 'Diverging column',
  '14.': 'Gauge',
  '15.': 'Progress rings',
  '16.': 'Radar',
  '17.': 'Treemap',
  '18.': 'Bubble scatter · size = holding',
  '19.': 'Fan chart · confidence bands',
  '20.': 'Stacked column + balance line',
}

/** Render one chart inside a provider with a "Replay animation" button. */
export function chartStory(
  chart: Component,
  props: Record<string, unknown>,
  /** `half`: the chart sits in one column of the two-column page grid (≈560px), as designed. */
  width: 'full' | 'half' = 'full',
) {
  return (raw: Record<string, unknown>) => {
    const args = raw as Partial<ChartControls>
    return {
      components: { KChartProvider, KButton, Chart: chart },
      setup: () => ({
        args,
        props: { kind: CHART_KINDS[String(props.index)], ...props },
        maxW: width === 'half' ? 'max-w-[580px]' : 'max-w-[1180px]',
      }),
      template: `
      <KChartProvider :palette="args.palette" :animation-speed="args.animationSpeed" :show-grid="args.showGrid" v-slot="{ replay }">
        <div :class="['flex flex-col gap-4', maxW]">
          <div><KButton size="sm" variant="secondary" @click="replay">Replay animation</KButton></div>
          <Chart v-bind="props" />
        </div>
      </KChartProvider>`,
    }
  }
}
