<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KStat from './KStat.vue'
import { squarify, type TreemapRect } from './lib/squarify'
import { dur, mk, money } from './lib/scale'

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
  kind = 'Treemap',
  ...settings
} = defineProps<
  {
    tiles: TreemapTile[]
    statLabel?: string
    title?: string
    index?: string
    kind?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

const model = computed(() => {
  const total = tiles.reduce((a, t) => a + t.value, 0)
  const auto = squarify(tiles.map((t) => t.value))
  return {
    total: money(total),
    tiles: tiles.map((t, i) => {
      const r = t.rect ?? auto[i]!
      const ci = t.color ?? i % 6
      return {
        ...t,
        pct: Math.round((t.value / total) * 100) + '%',
        val: mk(t.value),
        style: { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` },
        bg: theme.value.P[ci]!,
        ink: theme.value.INK[ci]!,
        dl: i * 100,
      }
    }),
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <KStat :label="statLabel" :value="model.total" />
    <ul class="relative m-0 h-[280px] list-none p-0" :aria-label="title">
      <li v-for="t in model.tiles" :key="t.label" class="absolute p-[3px]" :style="t.style">
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
