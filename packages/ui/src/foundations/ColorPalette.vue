<script setup lang="ts">
import { ref } from 'vue'

import DocCard from './DocCard.vue'

interface Swatch {
  role: string
  token: string
  hex: string
}

const groups: { name: string; swatches: Swatch[] }[] = [
  {
    name: 'Brand',
    swatches: [
      { role: 'Primary', token: 'blue-600', hex: '#2457D6' },
      { role: 'Hover', token: 'blue-500', hex: '#2F62E0' },
      { role: 'Pressed', token: 'blue-700', hex: '#1D45AC' },
      { role: 'Accent', token: 'blue-300', hex: '#93B6FF' },
      { role: 'Soft', token: 'blue-200', hex: '#DCE6FF' },
      { role: 'Subtle', token: 'blue-100', hex: '#EEF3FF' },
    ],
  },
  {
    name: 'Neutral',
    swatches: [
      { role: 'Ink', token: 'gray-900', hex: '#0F1B2D' },
      { role: 'Secondary text', token: 'gray-600', hex: '#52617D' },
      { role: 'Disabled text', token: 'gray-500', hex: '#627089' },
      { role: 'Control outline', token: 'gray-450', hex: '#7A89A2' },
      { role: 'Muted', token: 'gray-400', hex: '#94A3BB' },
      { role: 'Divider', token: 'gray-300', hex: '#D4DAE4' },
      { role: 'Border', token: 'gray-200', hex: '#E8ECF3' },
      { role: 'Recessed', token: 'gray-100', hex: '#F4F6FA' },
    ],
  },
  {
    name: 'Semantic',
    swatches: [
      { role: 'Success', token: 'green-600', hex: '#137744' },
      { role: 'Warning', token: 'amber-600', hex: '#935405' },
      { role: 'Danger', token: 'red-600', hex: '#C42B37' },
    ],
  },
]

const copied = ref<string | null>(null)
async function copy(s: Swatch) {
  await navigator.clipboard?.writeText(s.hex).catch(() => undefined)
  copied.value = s.token
  setTimeout(() => (copied.value = null), 1200)
}
</script>

<template>
  <DocCard index="01." title="Color palette" meta="Click a swatch to copy">
    <div v-for="g in groups" :key="g.name" class="flex flex-col gap-3">
      <span class="text-xs font-semibold tracking-label text-fg-muted uppercase">{{ g.name }}</span>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        <button
          v-for="s in g.swatches"
          :key="s.token"
          type="button"
          class="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-line bg-surface p-0 text-left shadow-raised-sm transition-transform duration-(--duration-fast) ease-standard hover:-translate-y-0.5 active:scale-[0.97]"
          @click="copy(s)"
        >
          <span class="block h-16" :style="{ background: s.hex }" />
          <span class="flex flex-col gap-0.5 p-3">
            <span class="sr-only">Copy</span>
            <span class="text-sm font-semibold">{{ s.role }}</span>
            <span class="font-mono text-xs text-fg-muted">{{ s.token }}</span>
            <span class="font-mono text-xs text-fg-muted">
              {{ copied === s.token ? 'Copied' : s.hex }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </DocCard>
</template>
