<script setup lang="ts">
import { KAmortizationChart, KButton, KSegmentedTabs, KStat } from '@khata/ui'
import { CalendarClock, Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { FREQUENCY_MONTHS, type RecurringKind } from '#shared/constants'
import { daysBetween, todayIST } from '#shared/dates'
import { totalInterest } from '#shared/loans'
import { formatINR } from '#shared/money'
import type { Recurring } from '#shared/types'
import DueList from '@/components/DueList.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import RecurringDialog from '@/components/RecurringDialog.vue'
import { useRecurring } from '@/lib/queries'

const recurring = useRecurring()
const tab = ref<'all' | RecurringKind>('all')
const open = ref(false)
const editing = ref<Recurring | null>(null)
watch(open, (o) => !o && (editing.value = null))

function edit(r: Recurring | null) {
  editing.value = r
  open.value = true
}

const all = computed(() => recurring.data.value ?? [])
const active = computed(() =>
  all.value.filter((r) => r.active && (tab.value === 'all' || r.kind === tab.value)),
)
const closed = computed(() =>
  all.value.filter((r) => !r.active && (tab.value === 'all' || r.kind === tab.value)),
)
const dueSoon = computed(() =>
  active.value.filter((r) => daysBetween(todayIST(), r.nextDueOn) <= 7),
)
const later = computed(() => active.value.filter((r) => daysBetween(todayIST(), r.nextDueOn) > 7))
const monthly = computed(() =>
  all.value
    .filter((r) => r.active)
    .reduce((a, r) => a + Math.round(r.amount / FREQUENCY_MONTHS[r.frequency]), 0),
)
const loans = computed(() => all.value.filter((r) => r.kind === 'emi' && r.active))
const outstanding = computed(() => loans.value.reduce((a, r) => a + (r.outstanding ?? 0), 0))
const tabs = [
  { value: 'all', label: 'All' },
  { value: 'bill', label: 'Bills' },
  { value: 'sip', label: 'SIPs' },
  { value: 'emi', label: 'EMIs' },
]
</script>

<template>
  <PageHeader
    title="Bills, SIPs & EMIs"
    subtitle="Mark paid in one tap — the entry is logged and the next due date is set."
  >
    <template #actions>
      <KButton class="gap-2" @click="edit(null)"><Plus :size="18" aria-hidden="true" />Add</KButton>
    </template>
  </PageHeader>

  <EmptyState
    v-if="recurring.data.value && !all.length"
    :icon="CalendarClock"
    title="Nothing recurring yet"
    body="Rent, electricity, mobile, school fees, SIPs and loan EMIs — add them once and get reminders here and on your overview."
  >
    <KButton @click="edit(null)">Add your first bill</KButton>
  </EmptyState>

  <template v-else-if="all.length">
    <section
      class="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised md:grid-cols-3"
    >
      <KStat label="Committed each month" :value="formatINR(monthly)" />
      <KStat label="Due this week" :value="String(dueSoon.length)" />
      <KStat v-if="loans.length" label="Loans outstanding" :value="formatINR(outstanding)" />
    </section>

    <KSegmentedTabs v-model="tab" :items="tabs" label="Filter by kind" />

    <section
      v-if="dueSoon.length"
      class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-raised sm:p-6"
    >
      <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Due in the next 7 days</h2>
      <DueList :items="dueSoon" @edit="edit" />
    </section>
    <section
      v-if="later.length"
      class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-raised sm:p-6"
    >
      <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Later</h2>
      <DueList :items="later" @edit="edit" />
    </section>

    <div v-if="(tab === 'all' || tab === 'emi') && loans.length" class="grid gap-6 lg:grid-cols-2">
      <section v-for="l in loans" :key="l.id" class="flex min-w-0 flex-col gap-3">
        <KAmortizationChart
          :principal="Math.round((l.loanPrincipal ?? 0) / 100)"
          :rate="(l.loanRatePct ?? 0) / 100"
          :years="Math.max(1, Math.ceil((l.loanTenureMonths ?? 12) / 12))"
          :title="l.name"
          :kind="`${l.paidCount} of ${l.loanTenureMonths} EMIs paid · ${formatINR(totalInterest(l.loanPrincipal ?? 0, l.loanRatePct ?? 0, l.loanTenureMonths ?? 1))} total interest`"
        />
      </section>
    </div>

    <section v-if="closed.length" class="flex flex-col gap-2">
      <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">Closed</h2>
      <DueList :items="closed" @edit="edit" />
    </section>
  </template>

  <RecurringDialog
    v-model:open="open"
    :editing="editing"
    :preset-kind="tab === 'all' ? 'bill' : tab"
  />
</template>
