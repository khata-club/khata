<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { cn } from '../lib/cn'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KSparkline from './KSparkline.vue'
import { money, pct, pctChange } from './lib/scale'

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
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  { accounts: SparkAccount[]; title?: string; index?: string; kind?: string } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

const items = computed(() =>
  accounts.map((a, i) => {
    const last = a.values[a.values.length - 1] ?? 0
    // Measured against |first| so going from −100 to +100 reads as a rise.
    const change = pctChange(a.values[0] ?? 0, last) ?? 0
    const good = a.inverse ? change <= 0 : change >= 0
    return {
      ...a,
      last: money(last),
      delta: pct(change),
      good,
      color: a.inverse ? theme.value.series[3]! : theme.value.series[0]!,
      delay: i * 140,
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
    :empty="!accounts.length"
    class="gap-6"
  >
    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
      <div
        v-for="(a, i) in items"
        :key="i"
        class="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-raised-sm"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-fg-muted">{{ a.name }}</span>
          <span
            :class="
              cn(
                'inline-flex h-[22px] items-center rounded-full px-2 font-mono text-[11px]',
                a.good ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
              )
            "
          >
            {{ a.delta }}
          </span>
        </div>
        <span class="text-2xl font-semibold tabular-nums">{{ a.last }}</span>
        <KSparkline :values="a.values" :color="a.color" :revealed="revealed" :delay="a.delay" />
      </div>
    </div>
  </KChartCard>
</template>
