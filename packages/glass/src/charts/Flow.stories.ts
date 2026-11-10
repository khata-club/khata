import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { incomeFlow, incomeToSavings, netCashFlow } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import GDivergingColumnChart from './GDivergingColumnChart.vue'
import GSankeyChart from './GSankeyChart.vue'
import GWaterfallChart from './GWaterfallChart.vue'

const meta = {
  title: 'Charts/Cash flow',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>
export default meta
type Story = StoryObj<typeof meta>

/** Hover a flow to highlight it. Labels are one line with a halo so they stay legible over flows. */
export const IncomeFlow: Story = {
  render: chartStory(GSankeyChart, {
    ...incomeFlow,
    title: 'Where October’s income went',
  }),
}
export const IncomeToSavings: Story = {
  render: chartStory(
    GWaterfallChart,
    { steps: incomeToSavings, statLabel: 'Saved in October' },
    'half',
  ),
}
export const NetCashFlow: Story = {
  render: chartStory(GDivergingColumnChart, netCashFlow, 'half'),
}
