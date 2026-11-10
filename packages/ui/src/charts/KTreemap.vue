<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KStat from './KStat.vue'
import { squarify, type TreemapRect } from './lib/squarify'
import { dur, compactMoney, money } from './lib/scale'

export interface TreemapTile {
  label: string
  value: number
  /** Palette index. */
  color?: number
  /** Fixed placement in percent; omit to use a squarified layout. */
  rect?: TreemapRect
}

const {
  tiles,
  statLabel = 'Invested',
  title = 'Portfolio allocation',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    tiles: TreemapTile[]
    statLabel?: string
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

const model = computed(() => {
  const total = tiles.reduce((a, t) => a + t.value, 0)
  const auto = squarify(tiles.map((t) => t.value))
  return {
    total: money(total),
    empty: !(total > 0),
    tiles: tiles.map((t, i) => {
      const r = t.rect ?? auto[i]!
      // Wrap past the end of the palette; `ink` is indexed the same way as `series`.
      const n = theme.value.series.length
      const ci = (((t.color ?? i) % n) + n) % n
      return {
        ...t,
        pct: (total > 0 ? Math.round((t.value / total) * 100) : 0) + '%',
        val: compactMoney(t.value),
        style: { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` },
        bg: theme.value.series[ci]!,
        ink: theme.value.ink[ci]!,
        dl: i * 100,
      }
    }),
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard
    ref="card"
    :title="title"
    :index="index"
    :kind="kind"
    :duration-scale="theme.durationScale"
    :empty="model.empty"
  >
    <KStat :label="statLabel" :value="model.total" />
    <ul class="relative m-0 h-[280px] list-none p-0" :aria-label="title">
      <li v-for="(t, i) in model.tiles" :key="i" class="absolute p-[3px]" :style="t.style">
        <div
          class="flex size-full flex-col justify-between overflow-hidden rounded-md p-3 hover:shadow-floating"
          :style="{
            background: t.bg,
            color: t.ink,
            opacity: revealed ? 1 : 0,
            transform: `scale(${revealed ? 1 : 0.9})`,
            transition: `opacity ${dur(500)} var(--ease-standard) ${dur(t.dl)}, transform ${dur(700)} var(--ease-standard) ${dur(t.dl)}, box-shadow var(--duration-normal) var(--ease-standard)`,
          }"
        >
          <span class="text-sm font-semibold">{{ t.label }}</span>
          <span class="flex justify-between gap-2 font-mono text-[11px]"
            ><span>{{ t.pct }}</span
            ><span>{{ t.val }}</span></span
          >
        </div>
      </li>
    </ul>
  </KChartCard>
</template>
