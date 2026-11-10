<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '../lib/cn'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import GSparkline from './GSparkline.vue'
import { money, pct } from './lib/scale'

export interface SparkAccount {
  name: string
  /** Daily balances, oldest first. */
  values: number[]
  /** Falling is good (e.g. a credit-card balance). */
  inverse?: boolean
}

const {
  accounts,
  title = 'Account sparklines',
  subtitle,
  ...settings
} = defineProps<{ accounts: SparkAccount[]; title?: string; subtitle?: string } & ChartSettings>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

const items = computed(() =>
  accounts.map((a, i) => {
    const last = a.values[a.values.length - 1]!
    const change = (last / a.values[0]! - 1) * 100
    const good = a.inverse ? change <= 0 : change >= 0
    return {
      ...a,
      last: money(last),
      delta: pct(change),
      good,
      color: a.inverse ? theme.value.P[3]! : theme.value.P[0]!,
      delay: i * 140,
    }
  }),
)

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k" class="gap-6">
    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
      <div
        v-for="a in items"
        :key="a.name"
        class="flex min-w-0 flex-col gap-3 rounded-lg bg-fill-quaternary p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-subhead font-semibold text-label-secondary">{{ a.name }}</span>
          <span
            :class="
              cn(
                'inline-flex h-[22px] items-center rounded-full px-2 text-[11px] tabular-nums',
                a.good ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative',
              )
            "
          >
            {{ a.delta }}
          </span>
        </div>
        <span class="text-title-2 font-semibold tabular-nums">{{ a.last }}</span>
        <GSparkline :values="a.values" :color="a.color" :revealed="revealed" :delay="a.delay" />
      </div>
    </div>
  </GChartCard>
</template>
