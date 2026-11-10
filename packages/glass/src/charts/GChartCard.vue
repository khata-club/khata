<script setup lang="ts">
import { cn } from '../lib/cn'

const {
  title,
  subtitle,
  k = 1,
  class: className,
} = defineProps<{
  title: string
  /** Quiet line under the title, e.g. the period ("Last 12 months"). */
  subtitle?: string
  /** Duration multiplier exposed to children as `--k`. */
  k?: number
  class?: string
}>()

defineSlots<{ default(): unknown; aside?(): unknown }>()
</script>

<template>
  <!-- Content, not chrome: charts sit on a plain grouped surface, never on glass. -->
  <article
    data-slot="chart-card"
    :class="cn('flex min-w-0 flex-col gap-4 rounded-xl bg-surface p-5 sm:p-6', className)"
    :style="{ '--k': k }"
  >
    <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div class="flex min-w-0 flex-col">
        <h3 class="m-0 text-body font-semibold">{{ title }}</h3>
        <span v-if="subtitle" class="text-footnote text-label-secondary">{{ subtitle }}</span>
      </div>
      <slot name="aside" />
    </header>
    <slot />
  </article>
</template>
