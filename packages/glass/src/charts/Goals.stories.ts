import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { goals, health } from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import GGauge from './GGauge.vue'
import GProgressRings from './GProgressRings.vue'
import GRadarChart from './GRadarChart.vue'

const meta = {
  title: 'Charts/Goals & health',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>
export default meta
type Story = StoryObj<typeof meta>

/** The score counts up as the arc sweeps. */
export const CreditScore: Story = {
  render: chartStory(GGauge, { value: 742 }, 'half'),
}
export const SavingsGoals: Story = {
  render: chartStory(GProgressRings, { goals }, 'half'),
}
export const FinancialHealth: Story = {
  render: chartStory(GRadarChart, health, 'half'),
}
