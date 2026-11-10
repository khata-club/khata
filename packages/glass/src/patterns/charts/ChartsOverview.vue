<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'

import GButton from '../../components/GButton.vue'
import * as data from '../../charts/fixtures/finance'
import GAmortizationChart from '../../charts/GAmortizationChart.vue'
import GAreaChart from '../../charts/GAreaChart.vue'
import GBubbleChart from '../../charts/GBubbleChart.vue'
import GBudgetBars from '../../charts/GBudgetBars.vue'
import GCalendarHeatmap from '../../charts/GCalendarHeatmap.vue'
import GCandlestickChart from '../../charts/GCandlestickChart.vue'
import GChartProvider from '../../charts/GChartProvider.vue'
import GColumnChart from '../../charts/GColumnChart.vue'
import GDivergingColumnChart from '../../charts/GDivergingColumnChart.vue'
import GDonutChart from '../../charts/GDonutChart.vue'
import GFanChart from '../../charts/GFanChart.vue'
import GGauge from '../../charts/GGauge.vue'
import GGroupedColumnChart from '../../charts/GGroupedColumnChart.vue'
import GProgressRings from '../../charts/GProgressRings.vue'
import GRadarChart from '../../charts/GRadarChart.vue'
import GSankeyChart from '../../charts/GSankeyChart.vue'
import GSparklineGrid from '../../charts/GSparklineGrid.vue'
import GStackedAreaChart from '../../charts/GStackedAreaChart.vue'
import GStackedColumnChart from '../../charts/GStackedColumnChart.vue'
import GTreemap from '../../charts/GTreemap.vue'
import GWaterfallChart from '../../charts/GWaterfallChart.vue'
import type { ChartPalette } from '../../charts/lib/palette'

defineProps<{ palette?: ChartPalette; animationSpeed?: number; showGrid?: boolean }>()

const groups = [
  { id: 'trends', label: 'Trends', blurb: 'Balances and prices over time.' },
  { id: 'spending', label: 'Spending', blurb: 'Where money goes, by month, category and day.' },
  { id: 'flow', label: 'Cash flow', blurb: 'How income becomes spending and savings.' },
  { id: 'goals', label: 'Goals & health', blurb: 'Scores and progress toward targets.' },
  {
    id: 'investing',
    label: 'Investing & planning',
    blurb: 'Portfolio composition, risk and long-range projections.',
  },
]
const grid = 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-4'
</script>

<template>
  <GChartProvider
    v-slot="{ replay }"
    :palette="palette"
    :animation-speed="animationSpeed"
    :show-grid="showGrid"
  >
    <div class="-m-8 min-h-screen bg-canvas font-sans text-label">
      <header class="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 pt-12 pb-8">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex flex-col gap-1">
            <span class="text-footnote text-label-secondary uppercase">Data visualization</span>
            <h1 class="m-0 text-large-title font-bold">Charts</h1>
            <p class="mt-1 mb-0 max-w-[560px] text-body [text-wrap:pretty] text-label-secondary">
              Twenty chart types for personal finance. Each animates in as it scrolls into view and
              responds to hover.
            </p>
          </div>
          <GButton variant="gray" size="sm" @click="replay"><RotateCcw />Replay animations</GButton>
        </div>
        <nav aria-label="Chart groups" class="flex flex-wrap gap-2">
          <a
            v-for="g in groups"
            :key="g.id"
            :href="`#${g.id}`"
            class="inline-flex h-8 items-center rounded-full bg-fill-tertiary px-3.5 text-subhead font-medium text-label no-underline transition-[background-color,scale] duration-(--duration-normal) hover:bg-fill-secondary active:scale-[0.96]"
          >
            {{ g.label }}
          </a>
        </nav>
      </header>

      <main class="mx-auto flex max-w-[1180px] flex-col gap-12 px-6 pb-16">
        <section v-for="g in groups" :id="g.id" :key="g.id" class="flex scroll-mt-6 flex-col gap-4">
          <div class="flex flex-wrap items-baseline justify-between gap-4">
            <h2 class="m-0 text-title-2 font-bold">{{ g.label }}</h2>
            <p class="m-0 text-subhead text-label-secondary">{{ g.blurb }}</p>
          </div>

          <div v-if="g.id === 'trends'" :class="grid">
            <GAreaChart v-bind="data.netWorth" class="col-span-full" />
            <GSparklineGrid :accounts="data.accounts" class="col-span-full" />
            <GCandlestickChart v-bind="data.holding" />
            <GStackedAreaChart v-bind="data.assetMix" />
          </div>

          <div v-else-if="g.id === 'spending'" :class="grid">
            <GColumnChart v-bind="data.monthlySpending" />
            <GGroupedColumnChart v-bind="data.incomeVsExpenses" />
            <GDonutChart :items="data.categories" center-label="October" />
            <GStackedColumnChart v-bind="data.categoryMix" />
            <GCalendarHeatmap v-bind="data.dailySpending" class="col-span-full" />
            <GBudgetBars :items="data.budgets" class="col-span-full" />
          </div>

          <div v-else-if="g.id === 'flow'" :class="grid">
            <GSankeyChart
              v-bind="data.incomeFlow"
              title="Where October’s income went"
              class="col-span-full"
            />
            <GWaterfallChart :steps="data.incomeToSavings" stat-label="Saved in October" />
            <GDivergingColumnChart v-bind="data.netCashFlow" />
          </div>

          <div
            v-else-if="g.id === 'goals'"
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4"
          >
            <GGauge :value="742" />
            <GProgressRings :goals="data.goals" />
            <GRadarChart v-bind="data.health" />
          </div>

          <div v-else :class="grid">
            <GTreemap :tiles="data.portfolio" />
            <GBubbleChart :points="data.riskReturn" />
            <GFanChart />
            <GAmortizationChart />
          </div>
        </section>
      </main>
    </div>
  </GChartProvider>
</template>
