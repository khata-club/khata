import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { incomeFlow, incomeToSavings, netCashFlow } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import KDivergingColumnChart from './KDivergingColumnChart.vue'
import KSankeyChart from './KSankeyChart.vue'
import KWaterfallChart from './KWaterfallChart.vue'

const meta = {
  title: 'Charts/Cash flow',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>
export default meta
type Story = StoryObj<typeof meta>

/** Hover a flow to highlight it. Labels are one line with a halo so they stay legible over flows. */
export const IncomeFlow: Story = {
  render: chartStory(KSankeyChart, {
    ...incomeFlow,
    title: 'Where October’s income went',
    index: '11.',
  }),
}
export const IncomeToSavings: Story = {
  render: chartStory(
    KWaterfallChart,
    { steps: incomeToSavings, statLabel: 'Saved in October', index: '12.' },
    'half',
  ),
}
export const NetCashFlow: Story = {
  render: chartStory(KDivergingColumnChart, { ...netCashFlow, index: '13.' }, 'half'),
}
