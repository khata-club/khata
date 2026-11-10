import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { accounts, assetMix, holding, netWorth } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import GAreaChart from './GAreaChart.vue'
import GCandlestickChart from './GCandlestickChart.vue'
import GSparklineGrid from './GSparklineGrid.vue'
import GStackedAreaChart from './GStackedAreaChart.vue'

const meta = {
  title: 'Charts/Trends',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>

export default meta
type Story = StoryObj<typeof meta>

/** Switch 6M · 1Y · 3Y · 5Y and the line reshapes; hover for a crosshair read-out. */
export const NetWorth: Story = { render: chartStory(GAreaChart, netWorth) }
export const AccountSparklines: Story = {
  render: chartStory(GSparklineGrid, { accounts }),
}
export const HoldingPrice: Story = {
  render: chartStory(GCandlestickChart, holding, 'half'),
}
export const AssetMix: Story = {
  render: chartStory(GStackedAreaChart, assetMix, 'half'),
}
