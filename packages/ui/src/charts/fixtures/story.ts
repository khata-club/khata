import type { ArgTypes } from '@storybook/vue3-vite'
import type { Component } from 'vue'

import KButton from '../../components/KButton.vue'
import KChartProvider from '../KChartProvider.vue'

/** The prototype's chart "Tweaks", as Storybook controls. */
export interface ChartControls {
  palette: 'Calm' | 'Monochrome'
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

/** Render one chart inside a provider with a "Replay animation" button. */
export function chartStory(
  chart: Component,
  props: Record<string, unknown>,
  /** `half`: the chart sits in one column of the two-column page grid (≈560px), as designed. */
  width: 'full' | 'half' = 'full',
) {
  return (raw: Record<string, unknown>) => {
    const args = raw as unknown as ChartControls
    return {
      components: { KChartProvider, KButton, Chart: chart },
      setup: () => ({ args, props, maxW: width === 'half' ? 'max-w-[580px]' : 'max-w-[1180px]' }),
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
