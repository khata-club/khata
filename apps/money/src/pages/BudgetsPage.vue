<script setup lang="ts">
import { KBadge, KBudgetBars, KButton, KDialog, KStat } from '@khata/ui'
import { Copy, PiggyBank, Plus } from '@lucide/vue'
import { computed, ref } from 'vue'

import { addMonths, formatMonth, monthOf, todayIST } from '#shared/dates'
import { formatINR } from '#shared/money'
import { bucket } from '#shared/plan'
import type { Budget } from '#shared/types'
import AmountField from '@/components/AmountField.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import MonthSwitcher from '@/components/MonthSwitcher.vue'
import PageHeader from '@/components/PageHeader.vue'
import SelectField from '@/components/SelectField.vue'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { budgetItems } from '@/lib/charts'
import { useBudgets, useLookups, useMutate, useSummary } from '@/lib/queries'

const month = ref(monthOf(todayIST()))
const budgets = useBudgets(month)
const summary = useSummary(month)
const { categories, categoryById } = useLookups()

const rows = computed(() =>
  (budgets.data.value ?? [])
    .map((b) => ({ ...b, pct: Math.round((b.spent / b.limit) * 100) }))
    .sort((a, b) => b.pct - a.pct),
)
const totals = computed(() =>
  rows.value.reduce((a, b) => ({ limit: a.limit + b.limit, spent: a.spent + b.spent }), {
    limit: 0,
    spent: 0,
  }),
)
const unbudgeted = computed(() => {
  const has = new Set(rows.value.map((r) => r.categoryId))
  return (summary.data.value?.byCategory ?? []).filter(
    (c) => c.categoryId && !has.has(c.categoryId),
  )
})
const bars = computed(() => budgetItems(budgets.data.value ?? [], categoryById.value))

// Set / edit dialog
const open = ref(false)
const form = ref<{ categoryId: string; limit: number | null }>({ categoryId: '', limit: null })
const editingExisting = ref(false)
const expenseOptions = computed(() =>
  (categories.data.value ?? [])
    .filter((c) => c.kind === 'expense')
    .map((c) => ({ value: c.id, label: c.name })),
)
function edit(b?: Pick<Budget, 'categoryId' | 'limit'>) {
  editingExisting.value = !!b?.limit
  form.value = { categoryId: b?.categoryId ?? '', limit: b?.limit || null }
  open.value = true
}
const save = useMutate(
  (v: { categoryId: string; limit: number }) => api.put('/budgets', { month: month.value, ...v }),
  ['budgets'],
  (_r, v) => {
    track('budget_set', { category: categoryById.value.get(v.categoryId)?.name ?? 'unknown' })
    open.value = false
  },
)
const copy = useMutate(
  () => api.post<Budget[]>('/budgets/copy', { from: addMonths(month.value, -1), to: month.value }),
  ['budgets'],
  (r) => track('budget_copy', { count_bucket: bucket(r.length) }),
)

const tone = (pct: number) => (pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'success')
</script>

<template>
  <PageHeader
    title="Budgets"
    subtitle="A monthly limit per category. Spending counts automatically."
  >
    <template #actions>
      <MonthSwitcher v-model="month" />
      <KButton size="sm" class="gap-2" @click="edit()"
        ><Plus :size="16" aria-hidden="true" />Set budget</KButton
      >
    </template>
  </PageHeader>

  <EmptyState
    v-if="budgets.data.value && !rows.length"
    :icon="PiggyBank"
    :title="`No budgets for ${formatMonth(month)}`"
    body="Start with the categories that surprise you most — dining, shopping or groceries."
  >
    <KButton @click="edit()">Set a budget</KButton>
    <KButton
      variant="secondary"
      class="gap-2"
      :loading="copy.isPending.value"
      @click="copy.mutate(undefined)"
    >
      <Copy :size="16" aria-hidden="true" />Copy
      {{ formatMonth(addMonths(month, -1), { short: true }) }}'s budgets
    </KButton>
  </EmptyState>

  <template v-else-if="rows.length">
    <section
      class="grid grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised"
    >
      <KStat label="Budgeted" :value="formatINR(totals.limit)" />
      <KStat label="Spent" :value="formatINR(totals.spent)" />
      <KStat
        :label="totals.spent > totals.limit ? 'Over by' : 'Left'"
        :value="formatINR(Math.abs(totals.limit - totals.spent))"
        :value-class="totals.spent > totals.limit ? 'text-danger' : 'text-success'"
      />
    </section>

    <div class="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section
        class="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 shadow-raised sm:p-6"
      >
        <ul class="m-0 flex list-none flex-col p-0">
          <li v-for="b in rows" :key="b.id">
            <button
              type="button"
              class="flex w-full cursor-pointer flex-col gap-2 rounded-lg border-0 bg-transparent px-2 py-3 text-left hover:bg-surface-subtle"
              @click="edit(b)"
            >
              <span class="flex items-center gap-3">
                <CategoryIcon :category="categoryById.get(b.categoryId)" :size="32" />
                <span class="min-w-0 flex-1 truncate font-semibold">{{
                  categoryById.get(b.categoryId)?.name
                }}</span>
                <KBadge :tone="tone(b.pct)">{{ b.pct }}%</KBadge>
              </span>
              <span class="h-2 overflow-hidden rounded-full bg-surface-recessed" aria-hidden="true">
                <span
                  class="block h-full rounded-full transition-[width] duration-(--duration-slow)"
                  :class="{
                    'bg-danger': b.pct > 100,
                    'bg-warning': b.pct >= 80 && b.pct <= 100,
                    'bg-success': b.pct < 80,
                  }"
                  :style="{ width: `${Math.min(100, b.pct)}%` }"
                />
              </span>
              <span class="flex justify-between font-mono text-xs text-fg-muted tabular-nums">
                <span>{{ formatINR(b.spent) }} of {{ formatINR(b.limit) }}</span>
                <span :class="b.spent > b.limit && 'text-danger'">
                  {{
                    b.spent > b.limit
                      ? `${formatINR(b.spent - b.limit)} over`
                      : `${formatINR(b.limit - b.spent)} left`
                  }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </section>
      <KBudgetBars :items="bars" title="Budget vs actual" :kind="formatMonth(month)" />
    </div>
  </template>

  <section v-if="unbudgeted.length" class="flex flex-col gap-3">
    <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">
      Spending without a budget
    </h2>
    <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
      <li v-for="u in unbudgeted" :key="u.categoryId!">
        <KButton
          size="sm"
          variant="outline"
          class="gap-2"
          @click="edit({ categoryId: u.categoryId!, limit: 0 })"
        >
          {{ categoryById.get(u.categoryId!)?.name }} · {{ formatINR(u.amount) }}
          <Plus :size="14" aria-hidden="true" />
        </KButton>
      </li>
    </ul>
  </section>

  <KDialog
    v-model:open="open"
    :title="editingExisting ? 'Edit budget' : 'Set a budget'"
    :description="formatMonth(month)"
  >
    <form
      id="budget-form"
      class="flex flex-col gap-4"
      @submit.prevent="
        form.categoryId &&
        form.limit != null &&
        save.mutate({ categoryId: form.categoryId, limit: form.limit })
      "
    >
      <SelectField v-model="form.categoryId" label="Category" :options="expenseOptions" required />
      <AmountField
        v-model="form.limit"
        label="Monthly limit"
        required
        hint="Set 0 to remove this budget."
      />
    </form>
    <template #footer>
      <KButton variant="secondary" @click="open = false">Cancel</KButton>
      <KButton
        type="submit"
        form="budget-form"
        :disabled="!form.categoryId || form.limit == null"
        :loading="save.isPending.value"
        >Save</KButton
      >
    </template>
  </KDialog>
</template>
