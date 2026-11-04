<script setup lang="ts">
import { ArrowLeft, RotateCcw } from '@lucide/vue'

import KButton from '../../components/KButton.vue'
import * as data from '../../charts/fixtures/finance'
import KAmortizationChart from '../../charts/KAmortizationChart.vue'
import KAreaChart from '../../charts/KAreaChart.vue'
import KBubbleChart from '../../charts/KBubbleChart.vue'
import KBudgetBars from '../../charts/KBudgetBars.vue'
import KCalendarHeatmap from '../../charts/KCalendarHeatmap.vue'
import KCandlestickChart from '../../charts/KCandlestickChart.vue'
import KChartProvider from '../../charts/KChartProvider.vue'
import KColumnChart from '../../charts/KColumnChart.vue'
import KDivergingColumnChart from '../../charts/KDivergingColumnChart.vue'
import KDonutChart from '../../charts/KDonutChart.vue'
import KFanChart from '../../charts/KFanChart.vue'
import KGauge from '../../charts/KGauge.vue'
import KGroupedColumnChart from '../../charts/KGroupedColumnChart.vue'
import KProgressRings from '../../charts/KProgressRings.vue'
import KRadarChart from '../../charts/KRadarChart.vue'
import KSankeyChart from '../../charts/KSankeyChart.vue'
import KSparklineGrid from '../../charts/KSparklineGrid.vue'
import KStackedAreaChart from '../../charts/KStackedAreaChart.vue'
import KStackedColumnChart from '../../charts/KStackedColumnChart.vue'
import KTreemap from '../../charts/KTreemap.vue'
import KWaterfallChart from '../../charts/KWaterfallChart.vue'
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
const grid = 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-6'
</script>

<template>
  <KChartProvider
    v-slot="{ replay }"
    :palette="palette"
    :animation-speed="animationSpeed"
    :show-grid="showGrid"
  >
    <div class="min-h-screen bg-canvas font-sans text-fg">
      <header class="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 pt-12 pb-8">
        <a
          href="#"
          class="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary no-underline hover:text-primary-pressed"
        >
          <ArrowLeft :size="16" aria-hidden="true" />Component library
        </a>
        <div class="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-5">
          <div class="flex flex-col gap-1">
            <span class="font-mono text-xs text-fg-muted">Level 05 · Data visualization</span>
            <h1 class="m-0 text-3xl font-semibold">Charts</h1>
            <p class="mt-1 mb-0 max-w-[560px] text-base [text-wrap:pretty] text-fg-muted">
              Twenty chart types for personal finance. Each animates in as it scrolls into view and
              responds to hover.
            </p>
          </div>
          <KButton variant="secondary" size="sm" @click="replay"
            ><RotateCcw />Replay animations</KButton
          >
        </div>
        <nav aria-label="Chart groups" class="flex flex-wrap gap-3">
          <a
            v-for="g in groups"
            :key="g.id"
            :href="`#${g.id}`"
            class="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg no-underline shadow-raised-sm transition-[transform,color] duration-(--duration-normal) ease-standard hover:-translate-y-px hover:text-primary"
          >
            {{ g.label }}
          </a>
        </nav>
      </header>

      <main class="mx-auto flex max-w-[1180px] flex-col gap-12 px-6 pb-16">
        <section v-for="g in groups" :id="g.id" :key="g.id" class="flex scroll-mt-6 flex-col gap-6">
          <div class="flex flex-wrap items-baseline justify-between gap-4">
            <h2 class="m-0 text-xl font-semibold">{{ g.label }}</h2>
            <p class="m-0 text-sm text-fg-muted">{{ g.blurb }}</p>
          </div>

          <div v-if="g.id === 'trends'" :class="grid">
            <KAreaChart v-bind="data.netWorth" index="01." class="col-span-full" />
            <KSparklineGrid :accounts="data.accounts" index="02." class="col-span-full" />
            <KCandlestickChart v-bind="data.holding" index="03." />
            <KStackedAreaChart v-bind="data.assetMix" index="04." />
          </div>

          <div v-else-if="g.id === 'spending'" :class="grid">
            <KColumnChart v-bind="data.monthlySpending" index="05." />
            <KGroupedColumnChart v-bind="data.incomeVsExpenses" index="06." />
            <KDonutChart :items="data.categories" center-label="October" index="07." />
            <KStackedColumnChart v-bind="data.categoryMix" index="08." />
            <KCalendarHeatmap v-bind="data.dailySpending" index="09." class="col-span-full" />
            <KBudgetBars :items="data.budgets" index="10." class="col-span-full" />
          </div>

          <div v-else-if="g.id === 'flow'" :class="grid">
            <KSankeyChart
              v-bind="data.incomeFlow"
              title="Where October’s income went"
              index="11."
              class="col-span-full"
            />
            <KWaterfallChart
              :steps="data.incomeToSavings"
              stat-label="Saved in October"
              index="12."
            />
            <KDivergingColumnChart v-bind="data.netCashFlow" index="13." />
          </div>

          <div
            v-else-if="g.id === 'goals'"
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6"
          >
            <KGauge :value="742" index="14." />
            <KProgressRings :goals="data.goals" index="15." />
            <KRadarChart v-bind="data.health" index="16." />
          </div>

          <div v-else :class="grid">
            <KTreemap :tiles="data.portfolio" index="17." />
            <KBubbleChart :points="data.riskReturn" index="18." />
            <KFanChart index="19." />
            <KAmortizationChart index="20." />
          </div>
        </section>
      </main>
    </div>
  </KChartProvider>
</template>
