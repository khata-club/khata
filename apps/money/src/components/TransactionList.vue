<script setup lang="ts">
import { computed } from 'vue'

import { PAYMENT_MODE_LABEL } from '#shared/constants'
import { formatDate } from '#shared/dates'
import { formatINR } from '#shared/money'
import type { Transaction } from '#shared/types'
import { openEntry } from '@/composables/useEntryDialog'
import { useLookups } from '@/lib/queries'

import CategoryIcon from './CategoryIcon.vue'

const { items, groupByDate = true } = defineProps<{ items: Transaction[]; groupByDate?: boolean }>()
const { accountById, categoryById } = useLookups()

const groups = computed(() => {
  const out: { date: string; items: Transaction[] }[] = []
  for (const t of items) {
    const last = out[out.length - 1]
    if (groupByDate && last?.date === t.occurredOn) last.items.push(t)
    else out.push({ date: t.occurredOn, items: [t] })
  }
  return out
})

function title(t: Transaction) {
  if (t.type === 'transfer')
    return `Transfer to ${accountById.value.get(t.toAccountId ?? '')?.name ?? 'account'}`
  return t.payee || categoryById.value.get(t.categoryId ?? '')?.name || 'Entry'
}
function meta(t: Transaction) {
  const parts = [
    t.type === 'transfer'
      ? null
      : t.payee
        ? categoryById.value.get(t.categoryId ?? '')?.name
        : null,
    accountById.value.get(t.accountId)?.name,
    t.paymentMode ? PAYMENT_MODE_LABEL[t.paymentMode] : null,
    t.taxSection,
  ]
  return parts.filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section v-for="g in groups" :key="g.date + g.items[0]!.id" class="flex flex-col gap-1">
      <h3 v-if="groupByDate" class="m-0 px-1 font-mono text-xs font-medium text-fg-muted">
        {{ formatDate(g.date) }}
      </h3>
      <ul class="m-0 flex list-none flex-col p-0">
        <li v-for="t in g.items" :key="t.id">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-2 py-2.5 text-left transition-colors duration-(--duration-normal) hover:bg-surface-subtle"
            @click="openEntry({ editing: t })"
          >
            <CategoryIcon
              :category="categoryById.get(t.categoryId ?? '')"
              :transfer="t.type === 'transfer'"
            />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-semibold">{{ title(t) }}</span>
              <span class="truncate text-xs text-fg-muted">{{
                groupByDate ? meta(t) : `${formatDate(t.occurredOn)} · ${meta(t)}`
              }}</span>
            </span>
            <span
              class="shrink-0 font-mono text-sm font-semibold tabular-nums"
              :class="
                t.type === 'income'
                  ? 'text-success'
                  : t.type === 'transfer'
                    ? 'text-fg-muted'
                    : 'text-fg'
              "
            >
              {{ t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
              }}{{ formatINR(t.amount, { paise: t.amount % 100 !== 0 }) }}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
