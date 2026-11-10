import type { Meta, StoryObj } from '@storybook/vue3-vite'

import {
  budgets,
  categories,
  categoryMix,
  dailySpending,
  incomeVsExpenses,
  monthlySpending,
} from './fixtures/finance'
import { chartArgs, chartArgTypes, chartStory, type ChartControls } from './fixtures/story'
import GBudgetBars from './GBudgetBars.vue'
import GCalendarHeatmap from './GCalendarHeatmap.vue'
import GColumnChart from './GColumnChart.vue'
import GDonutChart from './GDonutChart.vue'
import GGroupedColumnChart from './GGroupedColumnChart.vue'
import GStackedColumnChart from './GStackedColumnChart.vue'

const meta = {
  title: 'Charts/Spending',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>

export default meta
type Story = StoryObj<typeof meta>

export const MonthlySpending: Story = {
  render: chartStory(GColumnChart, monthlySpending, 'half'),
}
export const IncomeVsExpenses: Story = {
  render: chartStory(GGroupedColumnChart, incomeVsExpenses, 'half'),
}
export const SpendingByCategory: Story = {
  render: chartStory(GDonutChart, { items: categories, centerLabel: 'October' }, 'half'),
}
export const CategoryMix: Story = {
  render: chartStory(GStackedColumnChart, categoryMix, 'half'),
}
export const DailySpending: Story = {
  render: chartStory(GCalendarHeatmap, dailySpending),
}
export const BudgetVsActual: Story = {
  render: chartStory(GBudgetBars, { items: budgets }),
}
