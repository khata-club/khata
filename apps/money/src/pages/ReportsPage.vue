<script setup lang="ts">
import { KCalendarHeatmap, KDonutChart, KGroupedColumnChart, KSankeyChart, KStat } from '@khata/ui'
import { computed, ref, watch } from 'vue'

import { PAYMENT_MODE_LABEL } from '#shared/constants'
import { daysInMonth, formatMonth, monthOf, parseISO, todayIST } from '#shared/dates'
import { formatINR } from '#shared/money'
import MonthSwitcher from '@/components/MonthSwitcher.vue'
import PageHeader from '@/components/PageHeader.vue'
import { track } from '@/lib/analytics'
import { donutItems, rupees, trendSeries } from '@/lib/charts'
import { useLookups, useSummary, useTrend } from '@/lib/queries'

const month = ref(monthOf(todayIST()))
const summary = useSummary(month)
const trend = useTrend(month, 12)
const { categoryById } = useLookups()
watch(month, () => track('report_view', { report: 'monthly' }), { immediate: true })

const s = computed(() => summary.data.value)
const donut = computed(() => (s.value ? donutItems(s.value.byCategory, categoryById.value, 8) : []))
const modes = computed(() =>
  (s.value?.byPaymentMode ?? []).map((m) => ({
    label: m.paymentMode ? PAYMENT_MODE_LABEL[m.paymentMode] : 'Not set',
    value: rupees(m.amount),
  })),
)
const trendData = computed(() => (trend.data.value ? trendSeries(trend.data.value) : null))

// Cash flow: income sources → spending categories (+ what was saved).
const sankey = computed(() => {
  if (!s.value || !s.value.income || s.value.expense > s.value.income) return null
  const sources = s.value.incomeByCategory.map((r) => ({
    label: categoryById.value.get(r.categoryId ?? '')?.name ?? 'Income',
    value: rupees(r.amount),
  }))
  const total = sources.reduce((a, x) => a + x.value, 0)
  const spend = donutItems(s.value.byCategory, categoryById.value, 5).map((d, i) => ({
    ...d,
    color: i,
  }))
  const spent = spend.reduce((a, x) => a + x.value, 0)
  return {
    sources,
    targets: [...spend, { label: 'Saved', value: total - spent, color: 'var(--color-success)' }],
  }
})

// Daily spend heatmap: Monday-first weeks covering the month.
const heat = computed(() => {
  const { y, m } = parseISO(`${month.value}-01`)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = daysInMonth(y, m)
  const cells = Math.ceil((lead + days) / 7) * 7
  const byDay = new Map(
    (s.value?.daily ?? []).map((d) => [Number(d.day.slice(8)), rupees(d.amount)]),
  )
  const values = Array.from({ length: cells }, (_, i) => byDay.get(i - lead + 1) ?? 0)
  const max = Math.max(...values, 1)
  return {
    values,
    start: new Date(Date.UTC(y, m - 1, 1 - lead)),
    thresholds: [Math.round(max * 0.15), Math.round(max * 0.35), Math.round(max * 0.6)] as [
      number,
      number,
      number,
    ],
  }
})
</script>

<template>
  <PageHeader title="Reports" :subtitle="formatMonth(month)">
    <template #actions><MonthSwitcher v-model="month" /></template>
  </PageHeader>

  <section
    v-if="s"
    class="grid grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised"
  >
    <KStat label="Income" :value="formatINR(s.income)" />
    <KStat label="Spent" :value="formatINR(s.expense)" />
    <KStat
      label="Saved"
      :value="formatINR(s.income - s.expense)"
      :value-class="s.income < s.expense ? 'text-danger' : 'text-success'"
    />
  </section>

  <p v-if="s && !s.expense && !s.income" class="m-0 text-fg-muted">
    Nothing logged for {{ formatMonth(month) }}.
  </p>

  <div class="grid gap-6 lg:grid-cols-2">
    <KDonutChart v-if="donut.length" :items="donut" title="By category" center-label="Spent" />
    <KDonutChart
      v-if="modes.length"
      :items="modes"
      title="By payment mode"
      center-label="Spent"
      kind="UPI vs card vs cash"
    />
  </div>
  <KSankeyChart
    v-if="sankey"
    :sources="sankey.sources"
    :targets="sankey.targets"
    title="Cash flow"
  />
  <div class="grid gap-6 lg:grid-cols-2">
    <KCalendarHeatmap
      v-if="s?.daily.length"
      :values="heat.values"
      :start="heat.start"
      :thresholds="heat.thresholds"
      title="Daily spending"
    />
    <KGroupedColumnChart
      v-if="trendData"
      :months="trendData.months"
      :income="trendData.income"
      :expenses="trendData.expenses"
      title="12-month trend"
    />
  </div>
</template>
