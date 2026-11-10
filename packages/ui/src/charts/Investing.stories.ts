import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { mortgage, portfolio, retirement, riskReturn } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import KAmortizationChart from './KAmortizationChart.vue'
import KBubbleChart from './KBubbleChart.vue'
import KFanChart from './KFanChart.vue'
import KTreemap from './KTreemap.vue'

const meta = {
  title: 'Charts/Investing & planning',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>
export default meta
type Story = StoryObj<typeof meta>

export const PortfolioAllocation: Story = {
  render: chartStory(KTreemap, { tiles: portfolio, index: '17.' }, 'half'),
}
/** Without fixed placement the treemap lays tiles out with a squarified algorithm. */
export const PortfolioAllocationAuto: Story = {
  name: 'Portfolio allocation (auto layout)',
  render: chartStory(
    KTreemap,
    { tiles: portfolio.map((t) => ({ ...t, rect: undefined })), index: '17.' },
    'half',
  ),
}
export const RiskVsReturn: Story = {
  render: chartStory(KBubbleChart, { points: riskReturn, index: '18.' }, 'half'),
}
/** Switch the monthly contribution and the bands reshape. */
export const RetirementProjection: Story = {
  render: chartStory(KFanChart, { ...retirement, index: '19.' }, 'half'),
}
export const MortgageAmortization: Story = {
  render: chartStory(KAmortizationChart, { ...mortgage, index: '20.' }, 'half'),
}
