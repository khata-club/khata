<script setup lang="ts">
import { ref } from 'vue'

import DocSection from './DocSection.vue'

const curves = [
  { name: 'ease-smooth', use: 'Layout, sheets, chart entrances — no overshoot' },
  { name: 'ease-snappy', use: 'Selection capsules, popovers — a hint of overshoot' },
  { name: 'ease-bouncy', use: 'Switches and playful confirmations' },
]
const on = ref(false)
</script>

<template>
  <DocSection
    title="Motion"
    subtitle="Springs sampled into CSS linear(). Every duration scales with --motion-scale; reduced motion sets it to 0."
  >
    <div class="flex flex-col gap-3 rounded-xl bg-surface p-5">
      <div
        v-for="c in curves"
        :key="c.name"
        class="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-4 max-sm:grid-cols-1"
      >
        <span class="flex flex-col">
          <span class="text-subhead font-semibold">{{ c.name }}</span>
          <span class="text-caption text-label-secondary">{{ c.use }}</span>
        </span>
        <span class="relative h-9 rounded-full bg-fill-tertiary">
          <span
            class="absolute top-1 left-1 h-7 w-12 rounded-full bg-accent shadow-thumb transition-[left] duration-(--duration-spring)"
            :style="{
              transitionTimingFunction: `var(--${c.name})`,
              left: on ? 'calc(100% - 52px)' : '4px',
            }"
          />
        </span>
      </div>
      <button
        type="button"
        class="mt-2 h-9 cursor-pointer self-start rounded-full bg-fill-tertiary px-4 text-subhead font-semibold text-tint transition-transform duration-(--duration-fast) active:scale-[0.96]"
        @click="on = !on"
      >
        Play springs
      </button>
    </div>
  </DocSection>
</template>
