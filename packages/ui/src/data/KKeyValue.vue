<script setup lang="ts">
import { cn } from '../lib/cn'

export interface KeyValueItem {
  key: string
  label: string
  value?: string | number | null
  /** Monospace value (IDs, hashes). */
  mono?: boolean
}

const { items, class: className } = defineProps<{ items: KeyValueItem[]; class?: string }>()
</script>

<template>
  <dl
    data-slot="key-value"
    :class="cn('m-0 grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-6 gap-y-2.5', className)"
  >
    <template v-for="item in items" :key="item.key">
      <dt class="text-sm text-fg-muted">{{ item.label }}</dt>
      <dd :class="cn('m-0 min-w-0 text-sm break-words', item.mono && 'font-mono text-[13px]')">
        <slot :name="item.key" :item="item">{{ item.value ?? '—' }}</slot>
      </dd>
    </template>
  </dl>
</template>
