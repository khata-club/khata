<script setup lang="ts">
import DocSection from './DocSection.vue'

const groups = [
  {
    name: 'Backgrounds',
    tokens: ['canvas', 'surface', 'surface-raised', 'surface-inset'],
  },
  {
    name: 'Labels',
    tokens: ['label', 'label-secondary', 'label-tertiary', 'tint'],
  },
  {
    name: 'Fills & lines',
    tokens: ['fill', 'fill-secondary', 'fill-tertiary', 'fill-quaternary', 'separator', 'control'],
  },
  {
    name: 'Accent & status',
    tokens: ['accent', 'accent-soft', 'positive', 'warning', 'negative', 'destructive'],
  },
  {
    name: 'System palette',
    tokens: [
      'blue',
      'teal',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'purple',
      'indigo',
      'gray',
    ],
  },
  {
    name: 'Chart series',
    tokens: [1, 2, 3, 4, 5, 6, 7].map((i) => `series-${i}`),
  },
]
</script>

<template>
  <DocSection
    title="Colour"
    subtitle="Every role is a light/dark pair. Text roles clear WCAG AA on canvas and surface in both."
  >
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
      <div
        v-for="theme in ['light', 'dark']"
        :key="theme"
        :data-theme="theme"
        class="flex flex-col gap-6 rounded-xl bg-canvas p-6 text-label"
      >
        <span class="text-footnote font-semibold text-label-secondary uppercase">{{ theme }}</span>
        <div v-for="g in groups" :key="g.name" class="flex flex-col gap-2">
          <h3 class="m-0 text-subhead font-semibold">{{ g.name }}</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            <div v-for="t in g.tokens" :key="t" class="flex flex-col gap-1.5">
              <span
                class="h-12 rounded-md shadow-[inset_0_0_0_0.5px_var(--color-separator)]"
                :style="{ background: `var(--color-${t})` }"
              />
              <span class="text-caption text-label-secondary">{{ t }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DocSection>
</template>
