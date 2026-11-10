<script setup lang="ts">
import { KBadge, KButton } from '@khata/ui'
import { computed } from 'vue'

import { RECURRING_KIND_LABEL } from '#shared/constants'
import { daysBetween, formatDate, todayIST } from '#shared/dates'
import { formatINR } from '#shared/money'
import { dueState } from '#shared/plan'
import type { Recurring } from '#shared/types'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useLookups, useMutate } from '@/lib/queries'

import CategoryIcon from './CategoryIcon.vue'

const { items } = defineProps<{ items: Recurring[] }>()
defineEmits<{ edit: [r: Recurring] }>()
const { categoryById, accountById } = useLookups()

const today = todayIST()
const rows = computed(() =>
  items.map((r) => {
    const state = dueState(r.nextDueOn, today)
    const d = daysBetween(today, r.nextDueOn)
    return {
      r,
      state,
      when:
        state === 'overdue'
          ? `${-d} day${d === -1 ? '' : 's'} overdue`
          : state === 'today'
            ? 'Due today'
            : d === 1
              ? 'Due tomorrow'
              : `Due ${formatDate(r.nextDueOn)}`,
    }
  }),
)

const pay = useMutate(
  (r: Recurring) => api.post(`/recurring/${r.id}/pay`, {}),
  ['recurring', 'transactions', 'accounts', 'reports', 'budgets', 'holdings'],
  (_res, r) => track('recurring_mark_paid', { kind: r.kind }),
)
</script>

<template>
  <ul class="m-0 flex list-none flex-col gap-1 p-0">
    <li
      v-for="{ r, state, when } in rows"
      :key="r.id"
      class="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5"
      :class="!r.active && 'opacity-60'"
    >
      <CategoryIcon :category="categoryById.get(r.categoryId ?? '')" />
      <button
        type="button"
        class="flex min-w-0 flex-[1_1_180px] cursor-pointer flex-col border-0 bg-transparent p-0 text-left"
        @click="$emit('edit', r)"
      >
        <span class="flex items-center gap-2 font-semibold">
          <span class="truncate">{{ r.name }}</span>
          <KBadge :dot="false" class="h-5 px-1.5 text-[11px]">{{
            RECURRING_KIND_LABEL[r.kind]
          }}</KBadge>
        </span>
        <span
          class="truncate text-xs"
          :class="
            state === 'overdue'
              ? 'font-semibold text-danger'
              : state === 'today'
                ? 'font-semibold text-warning'
                : 'text-fg-muted'
          "
        >
          {{ r.active ? when : 'Closed' }} · {{ accountById.get(r.accountId)?.name }}
          <template v-if="r.outstanding != null"> · {{ formatINR(r.outstanding) }} left</template>
        </span>
      </button>
      <div class="flex items-center gap-3 max-sm:w-full max-sm:justify-end max-sm:pl-12">
        <span class="font-mono text-sm font-semibold tabular-nums">{{ formatINR(r.amount) }}</span>
        <KButton
          v-if="r.active"
          size="sm"
          :variant="state === 'later' ? 'secondary' : 'primary'"
          :loading="pay.isPending.value && pay.variables.value?.id === r.id"
          @click="pay.mutate(r)"
          >Mark paid</KButton
        >
      </div>
    </li>
  </ul>
</template>
