<script setup lang="ts">
import DocCard from './DocCard.vue'

const spacing = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]
const radii = [
  { token: 'rounded-sm', px: '8px', cls: 'rounded-sm' },
  { token: 'rounded-md', px: '12px', cls: 'rounded-md' },
  { token: 'rounded-lg', px: '20px', cls: 'rounded-lg' },
  { token: 'rounded-xl', px: '24px', cls: 'rounded-xl' },
  { token: 'rounded-2xl', px: '28px', cls: 'rounded-2xl' },
  { token: 'rounded-full', px: 'pill', cls: 'rounded-full' },
]
</script>

<template>
  <DocCard index="03." title="Spacing & radii" meta="4px base unit">
    <div class="flex flex-col gap-2">
      <div
        v-for="n in spacing"
        :key="n"
        class="grid grid-cols-[96px_minmax(0,1fr)_56px] items-center gap-4"
      >
        <span class="font-mono text-xs text-fg-muted">space-{{ n }}</span>
        <span class="h-3 rounded-sm bg-primary-soft" :style="{ width: `${n * 4}px` }" />
        <span class="text-right font-mono text-xs text-fg-muted">{{ n * 4 }}px</span>
      </div>
    </div>
    <div class="h-px bg-line" />
    <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-6">
      <div v-for="r in radii" :key="r.token" class="flex flex-col items-center gap-2">
        <span class="size-20 border-2 border-primary-accent bg-primary-subtle" :class="r.cls" />
        <span class="font-mono text-xs">{{ r.token }}</span>
        <span class="font-mono text-xs text-fg-muted">{{ r.px }}</span>
      </div>
    </div>
  </DocCard>
</template>
