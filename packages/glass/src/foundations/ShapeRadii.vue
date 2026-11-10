<script setup lang="ts">
import DocSection from './DocSection.vue'

const radii = [
  ['xs', '6'],
  ['sm', '10'],
  ['md', '14'],
  ['lg', '18'],
  ['xl', '26'],
  ['2xl', '34'],
  ['full', 'capsule'],
]
</script>

<template>
  <DocSection
    title="Shape"
    subtitle="Controls are capsules. Containers round to 26px and nest concentrically: inner radius = outer − padding."
  >
    <div class="flex flex-wrap gap-4 rounded-xl bg-surface p-5">
      <div v-for="[k, v] in radii" :key="k" class="flex flex-col items-center gap-2">
        <span
          class="block h-16 w-24 bg-accent-soft shadow-[inset_0_0_0_1px_var(--color-tint)]"
          :style="{ borderRadius: k === 'full' ? '999px' : `var(--radius-${k})` }"
        />
        <span class="text-caption text-label-secondary">{{ k }} · {{ v }}</span>
      </div>
    </div>
    <div class="flex w-fit items-center gap-2 rounded-2xl glass-regular p-2">
      <span class="grid h-12 place-items-center rounded-[26px] bg-accent px-6 text-on-accent">
        34 − 8 = 26
      </span>
      <span class="pr-3 text-footnote text-label-secondary">Concentric nesting</span>
    </div>
  </DocSection>
</template>
