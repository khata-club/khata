<script setup lang="ts">
import DocCard from './DocCard.vue'

const weights = [
  ['Light', 300],
  ['Regular', 400],
  ['Medium', 500],
  ['SemiBold', 600],
  ['Bold', 700],
] as const

const scale = [
  { cls: 'text-display', token: 'text-display', spec: '48 / 56' },
  { cls: 'text-3xl', token: 'text-3xl', spec: '30 / 38' },
  { cls: 'text-2xl', token: 'text-2xl', spec: '24 / 32' },
  { cls: 'text-xl', token: 'text-xl', spec: '20 / 28' },
  { cls: 'text-lg', token: 'text-lg', spec: '18 / 28' },
  { cls: 'text-base', token: 'text-base', spec: '16 / 24' },
  { cls: 'text-sm', token: 'text-sm', spec: '14 / 20' },
  { cls: 'text-xs', token: 'text-xs', spec: '12 / 16' },
]
</script>

<template>
  <DocCard index="02." title="Typography" meta="Quicksand · Geist Mono">
    <div class="flex flex-wrap items-center gap-8">
      <span class="text-[96px] leading-none font-semibold">Aa</span>
      <div class="w-px self-stretch bg-line" />
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold">Quicksand</span>
        <span
          v-for="[name, w] in weights"
          :key="w"
          class="flex gap-3 text-sm"
          :style="{ fontWeight: w }"
        >
          <span class="w-20">{{ name }}</span>
          <span class="font-mono text-xs text-fg-muted">{{ w }}</span>
        </span>
      </div>
    </div>
    <div class="flex flex-col">
      <div
        v-for="t in scale"
        :key="t.token"
        class="grid grid-cols-[120px_80px_minmax(0,1fr)] items-baseline gap-4 border-t border-line py-3"
      >
        <span class="font-mono text-xs text-fg-muted">{{ t.token }}</span>
        <span class="font-mono text-xs text-fg-muted">{{ t.spec }}</span>
        <span :class="t.cls" class="truncate font-semibold">Calm, tactile interfaces</span>
      </div>
    </div>
  </DocCard>
</template>
