<script setup lang="ts">
import DocCard from './DocCard.vue'

const levels = [
  { name: 'Flat', token: 'shadow-none', cls: 'shadow-none border border-line' },
  { name: 'Raised · subtle', token: 'shadow-raised-sm', cls: 'shadow-raised-sm' },
  { name: 'Raised', token: 'shadow-raised', cls: 'shadow-raised' },
  { name: 'Recessed', token: 'shadow-recessed', cls: 'shadow-recessed bg-surface-recessed' },
  { name: 'Floating', token: 'shadow-floating', cls: 'shadow-floating' },
  { name: 'Primary', token: 'shadow-primary-raised', cls: 'shadow-primary-raised bg-primary' },
]
</script>

<template>
  <DocCard index="04." title="Elevation" meta="Light from top-left · Depth toolbar scales it">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-8 p-2">
      <div v-for="l in levels" :key="l.token" class="flex flex-col items-center gap-3">
        <span class="h-24 w-full rounded-lg bg-surface" :class="l.cls" />
        <span class="text-sm font-semibold">{{ l.name }}</span>
        <span class="font-mono text-xs text-fg-muted">{{ l.token }}</span>
      </div>
    </div>
  </DocCard>
</template>
