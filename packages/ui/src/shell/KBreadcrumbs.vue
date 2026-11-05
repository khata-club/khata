<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

export interface Breadcrumb {
  label: string
  href?: string
}

const { items, label = 'Breadcrumb' } = defineProps<{ items: Breadcrumb[]; label?: string }>()
</script>

<template>
  <nav :aria-label="label" data-slot="breadcrumbs">
    <ol class="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
      <li v-for="(item, i) in items" :key="i" class="flex items-center gap-1">
        <ChevronRight v-if="i > 0" :size="14" aria-hidden="true" class="shrink-0" />
        <span
          v-if="i === items.length - 1 || !item.href"
          :aria-current="i === items.length - 1 ? 'page' : undefined"
          :class="i === items.length - 1 ? 'font-semibold text-fg' : undefined"
        >
          {{ item.label }}
        </span>
        <!-- Slot lets apps render a router link; defaults to a plain anchor. -->
        <slot v-else name="link" :item="item">
          <a :href="item.href" class="text-fg-muted no-underline hover:text-primary">
            {{ item.label }}
          </a>
        </slot>
      </li>
    </ol>
  </nav>
</template>
