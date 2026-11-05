<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KStat from './KStat.vue'
import { dur, MONTHS, money } from './lib/scale'

const {
  values,
  start,
  thresholds = [40, 90, 150],
  title = 'Daily spending',
  index,
  kind,
  ...settings
} = defineProps<
  {
    /** One value per day, Monday-first weeks (length a multiple of 7). */
    values: number[]
    /** The Monday of the first week. */
    start: Date
    /** Upper bounds for levels 1–3 (0 = no spend, above the last = level 4). */
    thresholds?: [number, number, number]
    title?: string
    index?: string
    kind?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)
const hover = ref<number | null>(null)

const LEVELS = ['#F4F6FA', '#DCE6FF', '#AFC6FB', '#5A80E6', '#2457D6']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const model = computed(() => {
  const weeks = Math.ceil(values.length / 7)
  const lvl = (v: number) =>
    v === 0 ? 0 : v < thresholds[0] ? 1 : v < thresholds[1] ? 2 : v < thresholds[2] ? 3 : 4
  const day = (i: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  const months: { n: string; gc: string }[] = []
  for (let c = 0; c < weeks; c++) {
    const d = day(c * 7)
    if (d.getDate() <= 7) months.push({ n: MONTHS[d.getMonth()]!, gc: `${c + 2} / span 4` })
  }
  const h = hover.value
  const tot = values.reduce((a, b) => a + b, 0)
  return {
    weeks,
    months,
    cells: values.map((v, i) => {
      const col = Math.floor(i / 7)
      const d = day(i)
      return {
        gr: (i % 7) + 2,
        gc: col + 2,
        bg: LEVELS[lvl(v)]!,
        dl: col * 28 + (i % 7) * 10,
        label: `${DAYS[i % 7]}, ${MONTHS[d.getMonth()]} ${d.getDate()}: ${money(v)}`,
      }
    }),
    label:
      h == null
        ? `Last ${weeks} weeks`
        : (() => {
            const d = day(h)
            return `${DAYS[h % 7]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
          })(),
    value: money(h == null ? tot : values[h]!),
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard
    ref="card"
    :title="title"
    :index="index"
    :kind="kind ?? `Calendar heatmap · ${model.weeks} weeks`"
    :k="theme.k"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <KStat :label="model.label" :value="model.value" />
      <div class="flex items-center gap-1.5 font-mono text-xs text-fg-muted" aria-hidden="true">
        Less<span
          v-for="l in LEVELS"
          :key="l"
          class="size-3.5 rounded-[4px]"
          :style="{ background: l }"
        />More
      </div>
    </div>
    <div
      class="grid items-center gap-1"
      :style="{ gridTemplateColumns: `32px repeat(${model.weeks}, minmax(0, 1fr))` }"
      role="img"
      :aria-label="`${title}: ${model.value} over ${model.weeks} weeks`"
      @pointerleave="hover = null"
    >
      <span
        v-for="m in model.months"
        :key="m.gc"
        class="row-start-1 font-mono text-[11px] whitespace-nowrap text-fg-muted"
        :style="{ gridColumn: m.gc }"
        >{{ m.n }}</span
      >
      <span
        v-for="(d, i) in ['Mon', 'Wed', 'Fri', 'Sun']"
        :key="d"
        class="col-start-1 font-mono text-[11px] text-fg-muted"
        :style="{ gridRow: i * 2 + 2 }"
        >{{ d }}</span
      >
      <span
        v-for="(c, i) in model.cells"
        :key="i"
        :title="c.label"
        class="aspect-square cursor-pointer rounded-[4px]"
        :style="{
          gridRow: c.gr,
          gridColumn: c.gc,
          background: c.bg,
          boxShadow: hover === i ? '0 0 0 2px #0F1B2D' : 'none',
          opacity: revealed ? 1 : 0,
          transform: `scale(${revealed ? 1 : 0.4})`,
          transition: `opacity ${dur(400)} var(--ease-standard) ${dur(c.dl)}, transform ${dur(500)} var(--ease-standard) ${dur(c.dl)}, box-shadow var(--duration-fast) var(--ease-standard)`,
        }"
        @pointerenter="hover = i"
      />
    </div>
  </KChartCard>
</template>
