<script setup lang="ts">
import type { Component } from 'vue'
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

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
    class="flex flex-col gap-6"
  >
    <TabsList
      :aria-label="label"
      :class="
        cn(
          'relative grid rounded-xl border border-line bg-surface p-1.5 shadow-raised-sm',
          className,
        )
      "
      :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
    >
      <!-- Pill glides to the active tab using Reka's measured size/position. -->
      <TabsIndicator
        class="absolute top-1.5 bottom-1.5 left-0 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) rounded-lg bg-primary shadow-primary-raised transition-[width,translate] duration-(--duration-slow) ease-standard"
      />
      <TabsTrigger
        v-for="t in items"
        :key="t.value"
        :value="t.value"
        class="relative z-1 flex h-[76px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-0 bg-transparent text-sm font-medium text-fg-muted transition-colors duration-(--duration-normal) ease-standard data-[state=active]:font-semibold data-[state=active]:text-on-primary"
      >
        <component :is="t.icon" v-if="t.icon" :size="24" aria-hidden="true" />
        {{ t.label }}
      </TabsTrigger>
    </TabsList>
    <!-- Reka makes the panel focusable (tabindex=0); keep the global focus ring visible. -->
    <TabsContent v-for="t in items" :key="t.value" :value="t.value" class="rounded-lg">
      <slot :name="t.value" />
    </TabsContent>
  </TabsRoot>
</template>
