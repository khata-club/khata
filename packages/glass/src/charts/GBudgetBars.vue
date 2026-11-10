<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import { dur, f, money } from './lib/scale'

export interface BudgetItem {
  name: string
  spent: number
  budget: number
}

const {
  items,
  title = 'Budget vs actual',
  subtitle,
  ...settings
} = defineProps<{ items: BudgetItem[]; title?: string; subtitle?: string } & ChartSettings>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

// The track spans 125% of the budget; the limit marker sits at 80%.
const rows = computed(() =>
  items.map((b, i) => {
    const over = b.spent > b.budget
    return {
      ...b,
      spentL: money(b.spent),
      budgetL: money(b.budget),
      w: `${f(Math.min(b.spent / (b.budget * 1.25), 1) * 100)}%`,
      over,
      note: over ? `${money(b.spent - b.budget)} over budget` : `${money(b.budget - b.spent)} left`,
      dl: i * 90,
    }
  }),
)

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k">
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-10 gap-y-5">
      <div v-for="b in rows" :key="b.name" class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-subhead font-semibold">{{ b.name }}</span>
          <span class="flex-none text-footnote whitespace-nowrap text-label-secondary tabular-nums"
            ><span class="text-label">{{ b.spentL }}</span> / {{ b.budgetL }}</span
          >
        </div>
        <div
          role="meter"
          :aria-label="`${b.name} spending`"
          :aria-valuenow="b.spent"
          aria-valuemin="0"
          :aria-valuemax="b.budget * 1.25"
          :aria-valuetext="`${b.spentL} of ${b.budgetL}, ${b.note}`"
          class="shadow-recessed relative h-3 rounded-full bg-fill-tertiary"
        >
          <span
            :class="['absolute inset-y-0 left-0 rounded-full', b.over ? 'bg-danger' : 'bg-accent']"
            :style="{
              width: revealed ? b.w : '0%',
              transition: `width ${dur(900)} var(--ease-smooth) ${dur(b.dl)}`,
            }"
          />
          <span
            class="bg-fg absolute -top-1 -bottom-1 left-[80%] w-0.5 rounded-[1px]"
            aria-hidden="true"
          />
        </div>
        <span
          :class="['text-footnote tabular-nums', b.over ? 'text-negative' : 'text-label-secondary']"
          >{{ b.note }}</span
        >
      </div>
    </div>
  </GChartCard>
</template>
