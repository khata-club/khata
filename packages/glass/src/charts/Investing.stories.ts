import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { portfolio, riskReturn } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import GAmortizationChart from './GAmortizationChart.vue'
import GBubbleChart from './GBubbleChart.vue'
import GFanChart from './GFanChart.vue'
import GTreemap from './GTreemap.vue'

const meta = {
  title: 'Charts/Investing & planning',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>
export default meta
type Story = StoryObj<typeof meta>

export const PortfolioAllocation: Story = {
  render: chartStory(GTreemap, { tiles: portfolio }, 'half'),
}
/** Without fixed placement the treemap lays tiles out with a squarified algorithm. */
export const PortfolioAllocationAuto: Story = {
  name: 'Portfolio allocation (auto layout)',
  render: chartStory(
    GTreemap,
    { tiles: portfolio.map((t) => ({ ...t, rect: undefined })) },
    'half',
  ),
}
export const RiskVsReturn: Story = {
  render: chartStory(GBubbleChart, { points: riskReturn }, 'half'),
}
/** Switch the monthly contribution and the bands reshape. */
export const RetirementProjection: Story = {
  render: chartStory(GFanChart, {}, 'half'),
}
export const MortgageAmortization: Story = {
  render: chartStory(GAmortizationChart, {}, 'half'),
}
