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
import KBudgetBars from './KBudgetBars.vue'
import KCalendarHeatmap from './KCalendarHeatmap.vue'
import KColumnChart from './KColumnChart.vue'
import KDonutChart from './KDonutChart.vue'
import KGroupedColumnChart from './KGroupedColumnChart.vue'
import KStackedColumnChart from './KStackedColumnChart.vue'

const meta = {
  title: 'Charts/Spending',
  argTypes: chartArgTypes,
  args: chartArgs,
} satisfies Meta<ChartControls>

export default meta
type Story = StoryObj<typeof meta>

export const MonthlySpending: Story = {
  render: chartStory(KColumnChart, { ...monthlySpending, index: '05.' }, 'half'),
}
export const IncomeVsExpenses: Story = {
  render: chartStory(KGroupedColumnChart, { ...incomeVsExpenses, index: '06.' }, 'half'),
}
export const SpendingByCategory: Story = {
  render: chartStory(
    KDonutChart,
    { items: categories, centerLabel: 'October', index: '07.' },
    'half',
  ),
}
export const CategoryMix: Story = {
  render: chartStory(KStackedColumnChart, { ...categoryMix, index: '08.' }, 'half'),
}
export const DailySpending: Story = {
  render: chartStory(KCalendarHeatmap, { ...dailySpending, index: '09.' }),
}
export const BudgetVsActual: Story = {
  render: chartStory(KBudgetBars, { items: budgets, index: '10.' }),
}
