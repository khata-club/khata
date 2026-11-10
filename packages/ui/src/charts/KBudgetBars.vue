<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { dur, round1, money } from './lib/scale'

export interface BudgetItem {
  name: string
  spent: number
  budget: number
}

const {
  items,
  title = 'Budget vs actual',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  { items: BudgetItem[]; title?: string; index?: string; kind?: string } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

/** The track spans this multiple of the budget, so overspend stays visible. */
const TRACK = 1.25
/** Where the budget limit sits on the track (80% for a 1.25× track). */
const LIMIT_AT = `${100 / TRACK}%`

const rows = computed(() =>
  items.map((b, i) => {
    const over = b.spent > b.budget
    return {
      ...b,
      spentL: money(b.spent),
      budgetL: money(b.budget),
      w: b.budget > 0 ? `${round1(Math.min(b.spent / (b.budget * TRACK), 1) * 100)}%` : '100%',
      over,
      note: over ? `${money(b.spent - b.budget)} over budget` : `${money(b.budget - b.spent)} left`,
      dl: i * 90,
    }
  }),
)

defineExpose({ replay })
</script>

<template>
  <KChartCard
    ref="card"
    :title="title"
    :index="index"
    :kind="kind"
    :duration-scale="theme.durationScale"
    :empty="!items.length"
  >
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-10 gap-y-5">
      <div v-for="(b, i) in rows" :key="i" class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm font-semibold">{{ b.name }}</span>
          <span class="flex-none font-mono text-xs whitespace-nowrap text-fg-muted tabular-nums"
            ><span class="text-fg">{{ b.spentL }}</span> / {{ b.budgetL }}</span
          >
        </div>
        <div
          role="meter"
          :aria-label="`${b.name} spending`"
          :aria-valuenow="b.spent"
          aria-valuemin="0"
          :aria-valuemax="b.budget * TRACK"
          :aria-valuetext="`${b.spentL} of ${b.budgetL}, ${b.note}`"
          class="relative h-3 rounded-full bg-surface-recessed shadow-recessed"
        >
          <span
            :class="['absolute inset-y-0 left-0 rounded-full', b.over ? 'bg-danger' : 'bg-primary']"
            :style="{
              width: revealed ? b.w : '0%',
              transition: `width ${dur(900)} var(--ease-standard) ${dur(b.dl)}`,
            }"
          />
          <span
            class="absolute -top-1 -bottom-1 w-0.5 rounded-[1px] bg-fg"
            :style="{ left: LIMIT_AT }"
            aria-hidden="true"
          />
        </div>
        <span :class="['font-mono text-xs', b.over ? 'text-danger' : 'text-fg-muted']">{{
          b.note
        }}</span>
      </div>
    </div>
  </KChartCard>
</template>
