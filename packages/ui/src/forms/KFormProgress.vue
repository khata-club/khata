<script setup lang="ts">
import { CircleAlert, CircleCheck, CircleDashed } from '@lucide/vue'
import { computed } from 'vue'

import KProgress from '../components/KProgress.vue'
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
const COLOR = { error: 'text-danger', complete: 'text-success', pending: 'text-fg-muted' }
const ICON_COLOR = { error: 'text-danger', complete: 'text-success', pending: 'text-fg-disabled' }
</script>

<template>
  <aside
    data-slot="form-progress"
    :class="
      cn(
        'flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-raised lg:sticky lg:top-6',
        className,
      )
    "
  >
    <div class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-xs font-semibold tracking-label text-fg-muted uppercase">Progress</span>
        <span class="font-mono text-xs">{{ done }} / {{ total }} required</span>
      </div>
      <KProgress :value="pct" :show-value="false" aria-label="Required fields complete" />
    </div>
    <nav aria-label="Form sections" class="flex flex-col">
      <a
        v-for="s in sections"
        :key="s.href"
        :href="s.href"
        class="flex min-h-(--touch-target) items-center gap-3 rounded-md px-3 text-fg no-underline transition-colors duration-(--duration-fast) hover:bg-surface-subtle"
      >
        <component
          :is="ICON[s.state]"
          :size="18"
          aria-hidden="true"
          :class="cn('shrink-0', ICON_COLOR[s.state])"
        />
        <span class="flex-1 text-sm font-semibold">{{ s.title }}</span>
        <span :class="cn('font-mono text-xs', COLOR[s.state])">{{ s.meta }}</span>
      </a>
    </nav>
    <slot />
  </aside>
</template>
