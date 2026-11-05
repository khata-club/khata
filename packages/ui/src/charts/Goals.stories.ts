import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { goals, health } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import KGauge from './KGauge.vue'
import KProgressRings from './KProgressRings.vue'
import KRadarChart from './KRadarChart.vue'

const meta = {
  title: 'Charts/Goals & health',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>
export default meta
type Story = StoryObj<typeof meta>

/** The score counts up as the arc sweeps. */
export const CreditScore: Story = {
  render: chartStory(KGauge, { value: 742, index: '14.' }, 'half'),
}
export const SavingsGoals: Story = {
  render: chartStory(KProgressRings, { goals, index: '15.' }, 'half'),
}
export const FinancialHealth: Story = {
  render: chartStory(KRadarChart, { ...health, index: '16.' }, 'half'),
}
