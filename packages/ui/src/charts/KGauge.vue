<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useCountUp } from '../composables/useCountUp'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { CHART } from './lib/palette'
import { dur, round1 } from './lib/scale'

export interface GaugeBand {
  label: string
  from: number
  to: number
}

const {
  value,
  bands,
  min: minProp,
  max: maxProp,
  title = 'Credit score',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    value: number
    /** Named ranges in ascending order, e.g. Poor / Fair / Good. */
    bands: GaugeBand[]
    /** Scale start (default: the first band's `from`). */
    min?: number
    /** Scale end (default: the last band's `to`). */
    max?: number
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

const min = computed(() => minProp ?? bands[0]?.from ?? 0)
const max = computed(() => maxProp ?? bands[bands.length - 1]?.to ?? 100)

/** Position on the arc, 0–100, clamped so an out-of-range value pins to an end. */
const percent = computed(() =>
  max.value > min.value
    ? Math.min(100, Math.max(0, ((value - min.value) / (max.value - min.value)) * 100))
    : 0,
)
const shown = useCountUp(() => (revealed.value ? value : min.value), {
  duration: () => 1400 * theme.value.durationScale,
  from: min.value,
})
// A band runs until the next one starts, so fractional values between integer bands
// (579.5 between 300–579 and 580–669) still match.
const active = computed(() =>
  bands.find((b, i) => value >= b.from && value < (bands[i + 1]?.from ?? Infinity)),
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
    :empty="!bands.length || max <= min"
  >
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
            strokeDasharray: revealed ? `${round1(percent)} 100` : '0 100',
            transition: `stroke-dasharray ${dur(1400)} var(--ease-standard)`,
          }"
        />
        <g
          :style="{
            transform: `rotate(${revealed ? round1(percent * 1.8) : 0}deg)`,
            transformBox: 'view-box',
            transformOrigin: '130px 130px',
            transition: `transform ${dur(1400)} var(--ease-standard)`,
          }"
        >
          <circle
            cx="30"
            cy="130"
            r="12"
            class="fill-surface"
            :stroke="CHART.primary"
            stroke-width="4"
          />
        </g>
        <text x="30" y="148" text-anchor="middle" class="fill-fg-muted font-mono text-[11px]">
          {{ min }}
        </text>
        <text x="230" y="148" text-anchor="middle" class="fill-fg-muted font-mono text-[11px]">
          {{ max }}
        </text>
      </svg>
      <div class="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span class="text-display font-semibold tabular-nums">{{ Math.round(shown) }}</span>
        <span class="text-sm font-semibold text-primary">{{ active?.label }}</span>
      </div>
    </div>
    <div
      class="grid gap-1"
      :style="{ gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))` }"
    >
      <div v-for="b in bands" :key="b.label" class="flex min-w-0 flex-col gap-1.5">
        <span :class="['h-1.5 rounded-full', b === active ? 'bg-primary' : 'bg-line']" />
        <span
          :class="[
            'text-[11px] leading-[14px]',
            b === active ? 'font-bold text-fg' : 'font-medium text-fg-muted',
          ]"
          >{{ b.label }}</span
        >
        <span class="font-mono text-[10px] text-fg-muted">{{ b.from }}–{{ b.to }}</span>
      </div>
    </div>
  </KChartCard>
</template>
