import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { accounts, assetMix, holding, netWorth } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import KAreaChart from './KAreaChart.vue'
import KCandlestickChart from './KCandlestickChart.vue'
import KSparklineGrid from './KSparklineGrid.vue'
import KStackedAreaChart from './KStackedAreaChart.vue'

const meta = {
  title: 'Charts/Trends',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>

export default meta
type Story = StoryObj<typeof meta>

/** Switch 6M · 1Y · 3Y · 5Y and the line reshapes; hover for a crosshair read-out. */
export const NetWorth: Story = { render: chartStory(KAreaChart, { ...netWorth, index: '01.' }) }
export const AccountSparklines: Story = {
  render: chartStory(KSparklineGrid, { accounts, index: '02.' }),
}
export const HoldingPrice: Story = {
  render: chartStory(KCandlestickChart, { ...holding, index: '03.' }, 'half'),
}
export const AssetMix: Story = {
  render: chartStory(KStackedAreaChart, { ...assetMix, index: '04.' }, 'half'),
}
