<script setup lang="ts">
import { cn } from '../lib/cn'

const {
  index,
  title,
  kind,
  durationScale = 1,
  empty = false,
  emptyText = 'No data to show yet',
  class: className,
} = defineProps<{
  /** Small mono number before the title, e.g. "01.". */
  index?: string
  title: string
  /** Mono descriptor on the right, e.g. "Area · range morph". */
  kind?: string
  /** Duration multiplier exposed to children as the `--k` CSS variable. */
  durationScale?: number
  /** Show `emptyText` instead of the chart (no data, or nothing to scale against). */
  empty?: boolean
  emptyText?: string
  class?: string
}>()

defineSlots<{ default(): unknown }>()
</script>

<template>
  <article
    data-slot="chart-card"
    :class="
      cn(
        'flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-raised max-sm:p-5',
        className,
      )
    "
    :style="{ '--k': durationScale }"
  >
    <header class="flex flex-wrap items-baseline gap-4">
      <span v-if="index" class="font-mono text-sm text-fg-muted">{{ index }}</span>
      <h3 class="m-0 text-sm font-semibold tracking-label uppercase">{{ title }}</h3>
      <span v-if="kind" class="ml-auto font-mono text-xs text-fg-muted">{{ kind }}</span>
    </header>
    <p
      v-if="empty"
      class="m-0 grid min-h-40 place-items-center rounded-lg bg-surface-subtle text-sm text-fg-muted"
    >
      {{ emptyText }}
    </p>
    <slot v-else />
  </article>
</template>
