<script setup lang="ts">
import { KButton, KSearchInput, KSegmentedControl, KSpinner } from '@khata/ui'
import { Download, Plus, ReceiptText } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { monthOf, todayIST } from '#shared/dates'
import { formatINR } from '#shared/money'
import EmptyState from '@/components/EmptyState.vue'
import MonthSwitcher from '@/components/MonthSwitcher.vue'
import PageHeader from '@/components/PageHeader.vue'
import SelectField from '@/components/SelectField.vue'
import TransactionList from '@/components/TransactionList.vue'
import { openEntry } from '@/composables/useEntryDialog'
import { qs } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useLookups, useSummary, useTransactions } from '@/lib/queries'

const month = ref(monthOf(todayIST()))
const type = ref('all')
const accountId = ref('all')
const categoryId = ref('all')
const q = ref('')
const search = ref('')
let t: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => {
  clearTimeout(t)
  t = setTimeout(() => (search.value = v.trim()), 250)
})

const filters = computed(() => ({
  month: month.value,
  type: type.value === 'all' ? undefined : type.value,
  accountId: accountId.value === 'all' ? undefined : accountId.value,
  categoryId: categoryId.value === 'all' ? undefined : categoryId.value,
  q: search.value || undefined,
}))
const list = useTransactions(filters)
const summary = useSummary(month)
const { accounts, categories } = useLookups()

const items = computed(() => list.data.value?.pages.flatMap((p) => p.items) ?? [])
const accountOptions = computed(() => [
  { value: 'all', label: 'All accounts' },
  ...(accounts.data.value ?? []).map((a) => ({ value: a.id, label: a.name })),
])
const categoryOptions = computed(() => [
  { value: 'all', label: 'All categories' },
  ...(categories.data.value ?? []).map((c) => ({
    value: c.id,
    label: `${c.name}${c.kind === 'income' ? ' (income)' : ''}`,
  })),
])
const typeOptions = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Spent' },
  { value: 'income', label: 'Received' },
  { value: 'transfer', label: 'Transfers' },
]
const exportHref = computed(() => `/api/export.csv${qs(filters.value)}`)
</script>

<template>
  <PageHeader
    title="Entries"
    :subtitle="
      summary.data.value
        ? `${formatINR(summary.data.value.expense)} spent · ${formatINR(summary.data.value.income)} received`
        : undefined
    "
  >
    <template #actions>
      <MonthSwitcher v-model="month" />
      <KButton
        variant="secondary"
        size="sm"
        class="gap-2"
        as="a"
        :href="exportHref"
        download
        @click="track('export_csv', { rows_bucket: 'filtered' })"
      >
        <Download :size="16" aria-hidden="true" />CSV
      </KButton>
      <KButton size="sm" class="gap-2" @click="openEntry()"
        ><Plus :size="16" aria-hidden="true" />Add</KButton
      >
    </template>
  </PageHeader>

  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end gap-3">
      <KSearchInput
        v-model="q"
        placeholder="Search payee or note"
        label="Search entries"
        class="min-w-0 flex-[1_1_240px]"
      />
      <KSegmentedControl v-model="type" :options="typeOptions" label="Entry type" size="sm" />
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <SelectField v-model="accountId" label="Account" :options="accountOptions" />
      <SelectField v-model="categoryId" label="Category" :options="categoryOptions" />
    </div>
  </div>

  <div v-if="list.isPending.value" class="grid place-items-center py-16 text-primary">
    <KSpinner class="size-6" />
  </div>
  <EmptyState
    v-else-if="!items.length"
    :icon="ReceiptText"
    title="No entries here"
    body="Try another month or clear the filters — or add something new."
  >
    <KButton @click="openEntry()">Add entry</KButton>
  </EmptyState>
  <section v-else class="rounded-xl border border-line bg-surface p-3 shadow-raised sm:p-5">
    <TransactionList :items="items" />
    <div v-if="list.hasNextPage.value" class="flex justify-center pt-4">
      <KButton
        variant="secondary"
        :loading="list.isFetchingNextPage.value"
        @click="list.fetchNextPage()"
        >Load more</KButton
      >
    </div>
  </section>
</template>
