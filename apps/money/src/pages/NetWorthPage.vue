<script setup lang="ts">
import { KButton, KColumnChart, KDialog, KStat, KTextField, KTreemap } from '@khata/ui'
import { Plus, Scale } from '@lucide/vue'
import { computed, reactive, ref } from 'vue'

import {
  HOLDING_KIND_LABEL,
  HOLDING_KINDS,
  TAX_SECTION_LABEL,
  TAX_SECTIONS,
  type HoldingKind,
} from '#shared/constants'
import { formatDate, formatMonth, parseISO, todayIST } from '#shared/dates'
import { formatCompactINR, formatINR } from '#shared/money'
import type { Holding } from '#shared/types'
import AmountField from '@/components/AmountField.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import SelectField from '@/components/SelectField.vue'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { rupees } from '@/lib/charts'
import { useHoldings, useMutate, useNetWorth } from '@/lib/queries'

const nw = useNetWorth()
const holdings = useHoldings()

const tiles = computed(() =>
  (nw.data.value?.byHoldingKind ?? []).map((h, i) => ({
    label: HOLDING_KIND_LABEL[h.kind],
    value: rupees(h.value),
    color: i % 6,
  })),
)
const history = computed(() => {
  const h = nw.data.value?.history ?? []
  return {
    values: h.map((p) => rupees(p.assets - p.liabilities)),
    months: h.map((p) => formatMonth(p.month, { short: true })),
    years: h.map((p) => parseISO(`${p.month}-01`).y),
  }
})
const gain = (h: Holding) => h.currentValue - h.invested

// Holding dialog
const open = ref(false)
const editing = ref<Holding | null>(null)
const form = reactive({
  kind: 'fd' as HoldingKind,
  name: '',
  invested: null as number | null,
  currentValue: null as number | null,
  asOf: todayIST(),
  taxSection: 'none',
  maturityOn: '',
})
function edit(h: Holding | null) {
  editing.value = h
  Object.assign(form, {
    kind: h?.kind ?? 'fd',
    name: h?.name ?? '',
    invested: h?.invested ?? null,
    currentValue: h?.currentValue ?? null,
    asOf: h ? todayIST() : todayIST(),
    taxSection: h?.taxSection ?? 'none',
    maturityOn: h?.maturityOn ?? '',
  })
  open.value = true
}
const kindOptions = HOLDING_KINDS.map((k) => ({ value: k, label: HOLDING_KIND_LABEL[k] }))
const taxOptions = [
  { value: 'none', label: 'None' },
  ...TAX_SECTIONS.map((s) => ({ value: s, label: TAX_SECTION_LABEL[s] })),
]
const save = useMutate(
  (body: object) =>
    editing.value
      ? api.patch<Holding>(`/holdings/${editing.value.id}`, body)
      : api.post<Holding>('/holdings', body),
  ['holdings', 'reports'],
  (h) => {
    track(editing.value ? 'holding_update' : 'holding_add', { kind: h.kind })
    open.value = false
  },
)
const remove = useMutate(
  () => api.del(`/holdings/${editing.value!.id}`),
  ['holdings', 'reports', 'recurring'],
  () => (open.value = false),
)
function submit() {
  if (!form.name || form.currentValue == null) return
  save.mutate({
    kind: form.kind,
    name: form.name,
    invested: form.invested ?? form.currentValue,
    currentValue: form.currentValue,
    asOf: form.asOf,
    taxSection: form.taxSection === 'none' ? null : form.taxSection,
    maturityOn: form.maturityOn || null,
  })
}
</script>

<template>
  <PageHeader
    title="Net worth"
    subtitle="What you own minus what you owe. Update values whenever you check your statements."
  >
    <template #actions>
      <KButton class="gap-2" @click="edit(null)"
        ><Plus :size="18" aria-hidden="true" />Add investment</KButton
      >
    </template>
  </PageHeader>

  <section
    v-if="nw.data.value"
    class="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-8"
  >
    <KStat
      label="Net worth"
      size="lg"
      :value="formatINR(nw.data.value.netWorth)"
      :value-class="nw.data.value.netWorth < 0 ? 'text-danger' : undefined"
    />
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KStat
        label="Bank, cash & wallets"
        :value="formatCompactINR(nw.data.value.cashAndBank)"
        size="sm"
      />
      <KStat label="Investments" :value="formatCompactINR(nw.data.value.holdings)" size="sm" />
      <KStat label="Card dues" :value="formatCompactINR(nw.data.value.cardDues)" size="sm" />
      <KStat label="Loans" :value="formatCompactINR(nw.data.value.loans)" size="sm" />
    </div>
  </section>

  <div
    class="grid gap-6"
    :class="{ 'lg:grid-cols-2': history.values.length > 1 && tiles.length > 0 }"
  >
    <KTreemap
      v-if="tiles.length"
      :tiles="tiles"
      title="Where it's invested"
      stat-label="Investments"
    />
    <KColumnChart
      v-if="history.values.length > 1"
      :values="history.values"
      :months="history.months"
      :years="history.years"
      title="Net worth by month"
      kind="Snapshot each month"
    />
  </div>

  <EmptyState
    v-if="holdings.data.value && !holdings.data.value.length"
    :icon="Scale"
    title="Add your investments"
    body="FDs, PPF, EPF, NPS, mutual funds, stocks, gold or property — just the current value is enough."
  >
    <KButton @click="edit(null)">Add investment</KButton>
  </EmptyState>
  <section
    v-else-if="holdings.data.value"
    class="rounded-xl border border-line bg-surface p-3 shadow-raised sm:p-5"
  >
    <ul class="m-0 flex list-none flex-col p-0">
      <li v-for="h in holdings.data.value" :key="h.id">
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-2 py-3 text-left hover:bg-surface-subtle"
          @click="edit(h)"
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate font-semibold">{{ h.name }}</span>
            <span class="truncate text-xs text-fg-muted">
              {{ HOLDING_KIND_LABEL[h.kind] }} · as of {{ formatDate(h.asOf)
              }}<template v-if="h.maturityOn"> · matures {{ formatDate(h.maturityOn) }}</template>
            </span>
          </span>
          <span class="flex flex-col items-end">
            <span class="font-mono text-sm font-semibold tabular-nums">{{
              formatINR(h.currentValue)
            }}</span>
            <span
              v-if="h.invested"
              class="font-mono text-xs tabular-nums"
              :class="gain(h) >= 0 ? 'text-success' : 'text-danger'"
            >
              {{ formatINR(gain(h), { sign: true }) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
  </section>

  <KDialog
    v-model:open="open"
    :title="editing ? 'Update investment' : 'Add investment'"
    class="max-h-[calc(100dvh-32px)] max-w-[520px] overflow-y-auto"
  >
    <form id="holding-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <SelectField v-model="form.kind" label="Type" :options="kindOptions" required />
      <KTextField
        v-model="form.name"
        label="Name"
        required
        maxlength="80"
        placeholder="e.g. SBI FD, PPF – post office, Nifty 50 index fund"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <AmountField v-model="form.invested" label="Invested" optional />
        <AmountField v-model="form.currentValue" label="Current value" required />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <KTextField v-model="form.asOf" label="Value as of" type="date" required />
        <KTextField v-model="form.maturityOn" label="Matures on" type="date" optional />
      </div>
      <SelectField
        v-model="form.taxSection"
        label="Tax section"
        :options="taxOptions"
        optional
        hint="For reference; 80C counts what you pay in each year (log it as an entry)."
      />
    </form>
    <template #footer>
      <KButton
        v-if="editing"
        variant="ghost"
        class="mr-auto text-danger"
        :loading="remove.isPending.value"
        @click="remove.mutate(undefined)"
        >Delete</KButton
      >
      <KButton variant="secondary" @click="open = false">Cancel</KButton>
      <KButton
        type="submit"
        form="holding-form"
        :disabled="!form.name || form.currentValue == null"
        :loading="save.isPending.value"
        >Save</KButton
      >
    </template>
  </KDialog>
</template>
