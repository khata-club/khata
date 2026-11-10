<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCountUp } from '@khata/ui'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import { CHART } from './lib/palette'
import { dur, f } from './lib/scale'

export interface GaugeBand {
  label: string
  from: number
  to: number
}

const {
  value,
  min = 300,
  max = 850,
  bands = [
    { label: 'Poor', from: 300, to: 579 },
    { label: 'Fair', from: 580, to: 669 },
    { label: 'Good', from: 670, to: 739 },
    { label: 'Very good', from: 740, to: 799 },
    { label: 'Exceptional', from: 800, to: 850 },
  ],
  title = 'Credit score',
  subtitle,
  ...settings
} = defineProps<
  {
    value: number
    min?: number
    max?: number
    bands?: GaugeBand[]
    title?: string
    /** Quiet line under the title. */
    subtitle?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

const p = computed(() => ((value - min) / (max - min)) * 100)
const shown = useCountUp(() => (revealed.value ? value : min), {
  duration: 1400 * theme.value.k,
  from: min,
})
const active = computed(() => bands.find((b) => value >= b.from && value <= b.to))

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k">
    <div
      class="relative mx-auto w-full max-w-[300px]"
      role="img"
      :aria-label="`${title}: ${value}, ${active?.label ?? ''}`"
    >
      <svg viewBox="0 0 260 150" class="block h-auto w-full overflow-visible" aria-hidden="true">
        <path
          d="M30,130 A100,100 0 0 1 230,130"
          fill="none"
          :stroke="CHART.track"
          stroke-width="18"
          stroke-linecap="round"
        />
        <path
          d="M30,130 A100,100 0 0 1 230,130"
          fill="none"
          :stroke="CHART.primary"
          stroke-width="18"
          stroke-linecap="round"
          pathLength="100"
          :style="{
            strokeDasharray: revealed ? `${f(p)} 100` : '0 100',
            transition: `stroke-dasharray ${dur(1400)} var(--ease-smooth)`,
          }"
        />
        <g
          :style="{
            transform: `rotate(${revealed ? f(p * 1.8) : 0}deg)`,
            transformBox: 'view-box',
            transformOrigin: '130px',
            transition: `transform ${dur(1400)} var(--ease-smooth)`,
          }"
        >
          <circle
            cx="30"
            cy="130"
            r="12"
            fill="var(--color-surface)"
            :stroke="CHART.primary"
            stroke-width="4"
          />
        </g>
        <text
          x="30"
          y="148"
          text-anchor="middle"
          class="fill-label-secondary text-[11px] tabular-nums"
        >
          {{ min }}
        </text>
        <text
          x="230"
          y="148"
          text-anchor="middle"
          class="fill-label-secondary text-[11px] tabular-nums"
        >
          {{ max }}
        </text>
      </svg>
      <div class="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span class="text-display font-semibold tabular-nums">{{ Math.round(shown) }}</span>
        <span class="text-subhead font-semibold text-tint">{{ active?.label }}</span>
      </div>
    </div>
    <div
      class="grid gap-1"
      :style="{ gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))` }"
    >
      <div v-for="b in bands" :key="b.label" class="flex min-w-0 flex-col gap-1.5">
        <span :class="['h-1.5 rounded-full', b === active ? 'bg-accent' : 'bg-separator']" />
        <span
          :class="[
            'text-[11px] leading-[14px]',
            b === active ? 'font-bold text-label' : 'font-medium text-label-secondary',
          ]"
          >{{ b.label }}</span
        >
        <span class="text-[10px] text-label-secondary tabular-nums">{{ b.from }}–{{ b.to }}</span>
      </div>
    </div>
  </GChartCard>
</template>
