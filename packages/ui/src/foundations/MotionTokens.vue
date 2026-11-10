<script setup lang="ts">
import { ref } from 'vue'

import DocCard from './DocCard.vue'

const rows = [
  { name: 'duration-fast', value: '120ms', v: '--duration-fast' },
  { name: 'duration-normal', value: '180ms', v: '--duration-normal' },
  { name: 'duration-slow', value: '260ms', v: '--duration-slow' },
]
const played = ref(false)
</script>

<template>
  <DocCard index="05." title="Motion" meta="ease-standard · cubic-bezier(0.2, 0, 0, 1)">
    <div class="flex flex-col gap-4">
      <div
        v-for="r in rows"
        :key="r.name"
        class="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-4"
      >
        <span class="flex flex-col">
          <span class="font-mono text-xs">{{ r.name }}</span>
          <span class="font-mono text-xs text-fg-muted">{{ r.value }} × motion</span>
        </span>
        <span class="relative h-8 rounded-full bg-surface-recessed shadow-recessed">
          <span
            class="absolute top-1 left-1 size-6 rounded-full bg-primary shadow-primary-sm transition-[left] ease-standard"
            :style="{
              transitionDuration: `var(${r.v})`,
              left: played ? 'calc(100% - 28px)' : '4px',
            }"
          />
        </span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-4">
      <button
        type="button"
        class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-primary-soft bg-surface px-4 text-sm font-semibold text-primary shadow-raised-sm transition-[box-shadow,translate,scale] duration-(--duration-normal) ease-standard hover:-translate-y-px hover:border-primary-accent hover:shadow-raised active:scale-[0.98] active:shadow-recessed"
        @click="played = !played"
      >
        Play durations
      </button>
      <span class="text-sm text-fg-muted">
        Hover lifts, press settles. Reduced-motion users get instant state changes.
      </span>
    </div>
  </DocCard>
</template>
