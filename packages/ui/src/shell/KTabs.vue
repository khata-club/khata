<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { cn } from '../lib/cn'

export interface TabItem {
  value: string
  label: string
  /** Optional count shown after the label. */
  count?: number
  disabled?: boolean
}

const {
  items,
  label,
  class: className,
} = defineProps<{
  items: TabItem[]
  /** Accessible name for the tab list. */
  label: string
  class?: string
}>()

const value = defineModel<string>()
</script>

<template>
  <TabsRoot
    v-model="value"
    :default-value="items[0]?.value"
    data-slot="tabs"
    class="flex flex-col gap-5"
  >
    <TabsList
      :aria-label="label"
      :class="cn('relative flex gap-1 overflow-x-auto border-b border-line', className)"
    >
      <TabsIndicator
        class="absolute bottom-0 left-0 h-0.5 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) rounded-full bg-primary transition-[width,translate] duration-(--duration-slow) ease-standard"
      />
      <TabsTrigger
        v-for="t in items"
        :key="t.value"
        :value="t.value"
        :disabled="t.disabled"
        class="flex h-11 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-sm font-medium whitespace-nowrap text-fg-muted transition-colors duration-(--duration-normal) ease-standard hover:text-fg disabled:cursor-not-allowed disabled:text-fg-disabled data-[state=active]:font-semibold data-[state=active]:text-primary-pressed"
      >
        {{ t.label }}
        <span
          v-if="t.count != null"
          class="rounded-full bg-surface-recessed px-2 py-0.5 text-xs font-semibold text-fg-muted"
        >
          {{ t.count }}
        </span>
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="t in items" :key="t.value" :value="t.value" class="outline-none">
      <slot :name="t.value" />
    </TabsContent>
  </TabsRoot>
</template>
