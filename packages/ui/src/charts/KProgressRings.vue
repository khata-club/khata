<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { seriesColor } from './lib/palette'
import { dur, money, round1 } from './lib/scale'

export interface RingGoal {
  label: string
  saved: number
  target: number
  /** Palette index (defaults 0, 1, 3, 4 by position). */
  color?: number
}

const {
  goals,
  title = 'Savings goals',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  { goals: RingGoal[]; title?: string; index?: string; kind?: string } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

/** Ring radii, outermost first: the chart shows at most this many goals. */
const RADII = [84, 62, 40, 18]
const DEFAULT_COLORS = [0, 1, 3, 4]

const rings = computed(() =>
  goals.slice(0, RADII.length).map((g, i) => {
    // A goal with no target counts as complete once anything is saved.
    const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : g.saved > 0 ? 100 : 0
    return {
      ...g,
      r: RADII[i]!,
      c: seriesColor(theme.value.series, g.color ?? DEFAULT_COLORS[i]!),
      dash: revealed.value ? `${round1(pct)} 100` : '0 100',
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
  <KChartCard
    ref="card"
    :title="title"
    :index="index"
    :kind="kind"
    :duration-scale="theme.durationScale"
    :empty="!goals.length"
  >
    <div class="mx-auto w-[200px] max-w-full">
      <svg viewBox="0 0 200 200" class="block h-auto w-full" aria-hidden="true">
        <g transform="rotate(-90 100 100)">
          <template v-for="(r, i) in rings" :key="i">
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
        v-for="(r, i) in rings"
        :key="i"
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
