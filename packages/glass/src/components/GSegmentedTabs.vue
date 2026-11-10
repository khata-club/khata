<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import type { Component } from 'vue'

import { cn } from '../lib/cn'

export interface SegmentedTab {
  value: string
  label: string
  icon?: Component
}

const {
  items,
  label,
  class: className,
} = defineProps<{
  items: SegmentedTab[]
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
    data-slot="segmented-tabs"
    class="flex flex-col gap-5"
  >
    <TabsList
      :aria-label="label"
      :class="cn('relative isolate grid self-start rounded-full bg-fill-tertiary p-0.5', className)"
      :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
    >
      <!-- Reka measures the active tab; the capsule springs to it. -->
      <TabsIndicator
        class="absolute inset-y-0.5 left-0 -z-1 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_0.5px_1.5px_rgb(0_0_0/0.1)] transition-[translate,width] duration-(--duration-spring) ease-snappy dark:bg-gray-2"
      />
      <TabsTrigger
        v-for="t in items"
        :key="t.value"
        :value="t.value"
        class="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-transparent px-4 text-subhead font-medium whitespace-nowrap text-label transition-[scale] duration-(--duration-normal) active:scale-[0.96] data-[state=active]:font-semibold [&_svg]:size-4"
      >
        <component :is="t.icon" v-if="t.icon" aria-hidden="true" />
        {{ t.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="t in items"
      :key="t.value"
      :value="t.value"
      class="animate-g-rise outline-none"
    >
      <slot :name="t.value" />
    </TabsContent>
  </TabsRoot>
</template>
