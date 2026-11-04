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
        'flex animate-ck-rise gap-4 rounded-lg border border-danger-border bg-danger-subtle px-6 py-5 outline-none focus-visible:outline-2',
        className,
      )
    "
  >
    <CircleAlert :size="22" aria-hidden="true" class="mt-0.5 shrink-0 text-danger" />
    <div class="flex min-w-0 flex-col gap-2">
      <span class="text-base font-bold">{{ title }}</span>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="it in items" :key="it.id" class="text-sm">
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-danger underline underline-offset-2"
            @click="go(it.id)"
          >
            {{ it.label }}</button
          ><span class="text-fg-muted"> · {{ it.message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
