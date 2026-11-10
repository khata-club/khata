<script setup lang="ts">
import { KBudgetBars, KButton, KDonutChart, KGroupedColumnChart, KStat } from '@khata/ui'
import { CalendarClock, Plus, ReceiptText } from '@lucide/vue'
import { computed } from 'vue'

import { daysBetween, formatMonth, monthOf, todayIST } from '#shared/dates'
import { formatCompactINR, formatINR } from '#shared/money'
import DueList from '@/components/DueList.vue'
import EmptyState from '@/components/EmptyState.vue'
import TransactionList from '@/components/TransactionList.vue'
import { openEntry } from '@/composables/useEntryDialog'
import { budgetItems, donutItems, trendSeries } from '@/lib/charts'
import {
  useBudgets,
  useLookups,
  useMe,
  useNetWorth,
  useRecurring,
  useSummary,
  useTransactions,
  useTrend,
} from '@/lib/queries'

const month = monthOf(todayIST())
const me = useMe()
const summary = useSummary(month)
const trend = useTrend(month, 6)
const budgets = useBudgets(month)
const recurring = useRecurring()
const networth = useNetWorth()
const recent = useTransactions({})
const { categoryById, accounts } = useLookups()

const s = computed(() => summary.data.value)
const saved = computed(() => (s.value ? s.value.income - s.value.expense : 0))
const savingsRate = computed(() => {
  const inc = s.value?.income || me.data.value?.prefs.monthlyIncome || 0
  return inc > 0 && s.value ? Math.round((saved.value / inc) * 100) : null
})
const upcoming = computed(() =>
  (recurring.data.value ?? [])
    .filter((r) => r.active && daysBetween(todayIST(), r.nextDueOn) <= 14)
    .slice(0, 6),
)
const recentItems = computed(() => recent.data.value?.pages[0]?.items.slice(0, 6) ?? [])
const donut = computed(() => (s.value ? donutItems(s.value.byCategory, categoryById.value) : []))
const trendData = computed(() => (trend.data.value ? trendSeries(trend.data.value) : null))
const hasTrend = computed(
  () =>
    !!trendData.value && trendData.value.income.concat(trendData.value.expenses).some((v) => v > 0),
)
const bars = computed(() => budgetItems(budgets.data.value ?? [], categoryById.value).slice(0, 5))
</script>

<template>
  <header class="flex flex-wrap items-end gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="font-mono text-xs text-fg-muted">{{ formatMonth(month) }}</span>
      <h1 class="m-0 text-3xl font-bold">
        Hi {{ me.data.value?.user.name.split(' ')[0] }}, here's your month
      </h1>
    </div>
    <KButton class="gap-2 max-lg:hidden" @click="openEntry({ source: 'quick_add' })"
      ><Plus :size="18" aria-hidden="true" />Add entry</KButton
    >
  </header>

  <section
    aria-label="This month"
    class="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised md:grid-cols-4"
  >
    <KStat label="Income" :value="formatINR(s?.income ?? 0)" />
    <KStat label="Spent" :value="formatINR(s?.expense ?? 0)" />
    <KStat
      label="Saved"
      :value="formatINR(saved)"
      :delta="savingsRate != null ? `${savingsRate}% of income` : undefined"
      :delta-tone="saved >= 0 ? 'good' : 'bad'"
      :value-class="saved < 0 ? 'text-danger' : undefined"
    />
    <RouterLink :to="{ name: 'net-worth' }" class="text-fg no-underline">
      <KStat
        label="Net worth"
        :value="networth.data.value ? formatCompactINR(networth.data.value.netWorth) : '—'"
        delta="View →"
        delta-tone="muted"
      />
    </RouterLink>
  </section>

  <EmptyState
    v-if="accounts.data.value && !accounts.data.value.length"
    :icon="ReceiptText"
    title="Add your first account"
    body="Bank, cash, UPI wallet or credit card — balances update as you log entries."
  >
    <KButton @click="$router.push('/app/accounts')">Add an account</KButton>
  </EmptyState>

  <div class="grid gap-6 lg:grid-cols-2">
    <KDonutChart
      v-if="donut.length"
      :items="donut"
      title="Where it went"
      center-label="Spent"
      kind="This month"
    />
    <section
      v-else
      class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-raised"
    >
      <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Where it went</h2>
      <p class="m-0 text-fg-muted">No spending logged this month yet.</p>
      <KButton variant="secondary" class="self-start" @click="openEntry({ source: 'quick_add' })"
        >Log an expense</KButton
      >
    </section>

    <section
      class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-8"
    >
      <header class="flex items-baseline gap-3">
        <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Coming up</h2>
        <RouterLink :to="{ name: 'bills' }" class="ml-auto text-sm font-semibold text-primary"
          >All bills →</RouterLink
        >
      </header>
      <DueList v-if="upcoming.length" :items="upcoming" />
      <EmptyState
        v-else
        :icon="CalendarClock"
        title="Nothing due in the next two weeks"
        body="Add rent, electricity, SIPs and EMIs to get reminders here."
      >
        <KButton variant="secondary" @click="$router.push('/app/bills')">Add a bill</KButton>
      </EmptyState>
    </section>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <KGroupedColumnChart
      v-if="hasTrend && trendData"
      :months="trendData.months"
      :income="trendData.income"
      :expenses="trendData.expenses"
      title="Last 6 months"
    />
    <KBudgetBars v-if="bars.length" :items="bars" title="Budget health" kind="This month" />
  </div>

  <section
    class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-8"
  >
    <header class="flex items-baseline gap-3">
      <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Recent entries</h2>
      <RouterLink :to="{ name: 'entries' }" class="ml-auto text-sm font-semibold text-primary"
        >See all →</RouterLink
      >
    </header>
    <TransactionList v-if="recentItems.length" :items="recentItems" :group-by-date="false" />
    <p v-else class="m-0 text-fg-muted">Your latest entries will show here.</p>
  </section>
</template>
