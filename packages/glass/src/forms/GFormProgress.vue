<script setup lang="ts">
import { CircleAlert, CircleCheck, CircleDashed } from '@lucide/vue'
import { computed } from 'vue'

import GProgress from '../components/GProgress.vue'
import { cn } from '../lib/cn'

export interface FormProgressSection {
  href: string
  title: string
  /** e.g. "2 issues", "Complete", "1 of 3". */
  meta: string
  state: 'error' | 'complete' | 'pending'
}

const {
  done,
  total,
  sections,
  class: className,
} = defineProps<{
  /** Required fields completed. */
  done: number
  total: number
  sections: FormProgressSection[]
  class?: string
}>()

const pct = computed(() => (total ? Math.round((done / total) * 100) : 0))
const ICON = { error: CircleAlert, complete: CircleCheck, pending: CircleDashed }
const COLOR = {
  error: 'text-negative',
  complete: 'text-positive',
  pending: 'text-label-secondary',
}
const ICON_COLOR = {
  error: 'text-negative',
  complete: 'text-positive',
  pending: 'text-label-tertiary',
}
</script>

<template>
  <aside
    data-slot="form-progress"
    :class="cn('flex flex-col gap-4 rounded-xl bg-surface p-4 lg:sticky lg:top-6', className)"
  >
    <div class="flex flex-col gap-2 px-1">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-footnote text-label-secondary uppercase">Progress</span>
        <span class="text-footnote text-label-secondary tabular-nums"
          >{{ done }} of {{ total }} required</span
        >
      </div>
      <GProgress :value="pct" :show-value="false" aria-label="Required fields complete" />
    </div>
    <nav aria-label="Form sections" class="flex flex-col">
      <a
        v-for="s in sections"
        :key="s.href"
        :href="s.href"
        class="flex min-h-11 items-center gap-3 rounded-[12px] px-2.5 text-label no-underline transition-colors duration-(--duration-fast) hover:bg-fill-quaternary"
      >
        <component
          :is="ICON[s.state]"
          :size="18"
          aria-hidden="true"
          :class="cn('shrink-0', ICON_COLOR[s.state])"
        />
        <span class="flex-1 text-subhead font-medium">{{ s.title }}</span>
        <span :class="cn('text-footnote tabular-nums', COLOR[s.state])">{{ s.meta }}</span>
      </a>
    </nav>
    <slot />
  </aside>
</template>
