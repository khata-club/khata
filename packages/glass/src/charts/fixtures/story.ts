import type { ArgTypes } from '@storybook/vue3-vite'
import type { Component } from 'vue'

import GButton from '../../components/GButton.vue'
import GChartProvider from '../GChartProvider.vue'

/** Chart tweaks, as Storybook controls. */
export interface ChartControls {
  palette: 'System' | 'Monochrome'
  animationSpeed: number
  showGrid: boolean
}

export const chartArgTypes: ArgTypes<ChartControls> = {
  palette: {
    control: 'inline-radio',
    options: ['System', 'Monochrome'],
    table: { category: 'Charts' },
  },
  animationSpeed: {
    control: { type: 'range', min: 0.5, max: 2, step: 0.25 },
    table: { category: 'Charts' },
  },
  showGrid: { control: 'boolean', table: { category: 'Charts' } },
}
export const chartArgs: ChartControls = { palette: 'System', animationSpeed: 1, showGrid: true }

/** Render one chart inside a provider with a "Replay" button. */
export function chartStory(
  chart: Component,
  props: Record<string, unknown>,
  /** `half`: the chart sits in one column of the two-column page grid (≈560px). */
  width: 'full' | 'half' = 'full',
) {
  return (raw: Record<string, unknown>) => {
    const args = raw as unknown as ChartControls
    return {
      components: { GChartProvider, GButton, Chart: chart },
      setup: () => ({ args, props, maxW: width === 'half' ? 'max-w-[580px]' : 'max-w-[1180px]' }),
      template: `
      <GChartProvider :palette="args.palette" :animation-speed="args.animationSpeed" :show-grid="args.showGrid" v-slot="{ replay }">
        <div :class="['flex flex-col gap-4', maxW]">
          <div><GButton size="sm" variant="gray" @click="replay">Replay</GButton></div>
          <Chart v-bind="props" />
        </div>
      </GChartProvider>`,
    }
  }
}
