<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { dur, f, money } from './lib/scale'

export interface RingGoal {
  label: string
  saved: number
  target: number
  /** Palette index (defaults 0, 1, 3). */
  color?: number
}

const {
  goals,
  title = 'Savings goals',
  index,
  kind = 'Progress rings',
  ...settings
} = defineProps<
  { goals: RingGoal[]; title?: string; index?: string; kind?: string } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

const rings = computed(() =>
  goals.slice(0, 4).map((g, i) => {
    const pct = Math.min(100, (g.saved / g.target) * 100)
    return {
      ...g,
      r: [84, 62, 40, 18][i]!,
      c: theme.value.P[g.color ?? [0, 1, 3, 4][i]!]!,
      dash: revealed.value ? `${f(pct)} 100` : '0 100',
      dl: i * 200,
      savedL: money(g.saved),
      targetL: money(g.target),
      pctL: Math.round(pct) + '%',
    }
  }),
)

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <div class="mx-auto w-[200px] max-w-full">
      <svg viewBox="0 0 200 200" class="block h-auto w-full" aria-hidden="true">
        <g transform="rotate(-90 100 100)">
          <template v-for="r in rings" :key="r.label">
            <circle
              cx="100"
              cy="100"
              :r="r.r"
              fill="none"
              :stroke="r.c"
              stroke-opacity="0.14"
              stroke-width="16"
            />
            <circle
              cx="100"
              cy="100"
              :r="r.r"
              fill="none"
              :stroke="r.c"
              stroke-width="16"
              stroke-linecap="round"
              pathLength="100"
              :style="{
                strokeDasharray: r.dash,
                transition: `stroke-dasharray ${dur(1300)} var(--ease-standard) ${dur(r.dl)}`,
              }"
            />
          </template>
        </g>
      </svg>
    </div>
    <ul class="m-0 flex list-none flex-col p-0" :aria-label="title">
      <li
        v-for="r in rings"
        :key="r.label"
        class="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-2"
      >
        <span class="size-2.5 rounded-full" :style="{ background: r.c }" />
        <span class="flex flex-col">
          <span class="text-sm font-semibold">{{ r.label }}</span>
          <span class="font-mono text-[11px] text-fg-muted">{{ r.savedL }} of {{ r.targetL }}</span>
        </span>
        <span class="font-mono text-sm font-medium">{{ r.pctL }}</span>
      </li>
    </ul>
  </KChartCard>
</template>
