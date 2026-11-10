<script setup lang="ts">
import DocSection from './DocSection.vue'

const styles = [
  { cls: 'text-display font-bold', name: 'Display', spec: '56 / 60 · bold' },
  { cls: 'text-large-title font-bold', name: 'Large Title', spec: '34 / 41 · bold' },
  { cls: 'text-title-1 font-bold', name: 'Title 1', spec: '28 / 34 · bold' },
  { cls: 'text-title-2 font-bold', name: 'Title 2', spec: '22 / 28 · bold' },
  { cls: 'text-title-3 font-semibold', name: 'Title 3', spec: '20 / 25 · semibold' },
  { cls: 'text-body font-semibold', name: 'Headline', spec: '17 / 22 · semibold' },
  { cls: 'text-body', name: 'Body', spec: '17 / 22' },
  { cls: 'text-callout', name: 'Callout', spec: '16 / 21' },
  { cls: 'text-subhead', name: 'Subheadline', spec: '15 / 20' },
  { cls: 'text-footnote', name: 'Footnote', spec: '13 / 18' },
  { cls: 'text-caption', name: 'Caption', spec: '12 / 16' },
  { cls: 'text-caption-2', name: 'Caption 2', spec: '11 / 13' },
]
</script>

<template>
  <DocSection
    title="Typography"
    subtitle="San Francisco on Apple platforms, Inter everywhere else. Figures use tabular numerals."
  >
    <div class="flex flex-col divide-y divide-separator rounded-xl bg-surface px-5">
      <div
        v-for="s in styles"
        :key="s.name"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-3"
      >
        <span :class="['truncate', s.cls]">{{ s.name }}</span>
        <span class="text-footnote text-label-secondary tabular-nums">{{ s.spec }}</span>
      </div>
    </div>
    <div class="rounded-xl bg-surface p-5 text-title-1 font-semibold tabular-nums">
      ₹1,24,580.00 <span class="text-body font-normal text-positive">+2.4%</span>
    </div>
  </DocSection>
</template>
