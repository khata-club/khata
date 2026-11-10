<script setup lang="ts">
import { CircleAlert } from '@lucide/vue'
import { ref } from 'vue'

import { cn } from '../lib/cn'

export interface ErrorSummaryItem {
  /** Id of the control to focus. */
  id: string
  label: string
  message: string
}

const {
  title,
  items,
  class: className,
} = defineProps<{
  title: string
  items: ErrorSummaryItem[]
  class?: string
}>()

const root = ref<HTMLElement>()

function go(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el?.focus({ preventScroll: true })
}

/** Move focus to the summary (do this after a failed submit). */
defineExpose({ focus: () => root.value?.focus() })
</script>

<template>
  <div
    ref="root"
    tabindex="-1"
    role="alert"
    data-slot="error-summary"
    :class="
      cn(
        'flex animate-g-rise gap-3 rounded-lg bg-negative-soft px-4 py-3.5 outline-none focus-visible:outline-3',
        className,
      )
    "
  >
    <CircleAlert :size="20" aria-hidden="true" class="mt-px shrink-0 text-negative" />
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-subhead font-semibold">{{ title }}</span>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="it in items" :key="it.id" class="text-footnote">
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 text-footnote font-semibold text-negative underline decoration-1 underline-offset-2"
            @click="go(it.id)"
          >
            {{ it.label }}</button
          ><span class="text-label-secondary"> — {{ it.message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
