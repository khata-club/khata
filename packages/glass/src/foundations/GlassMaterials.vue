<script setup lang="ts">
import DocSection from './DocSection.vue'

const materials = [
  { cls: 'glass-thin', name: 'Thin', use: 'Controls over content' },
  { cls: 'glass-regular', name: 'Regular', use: 'Nav bars, tab bars, toolbars' },
  { cls: 'glass-thick', name: 'Thick', use: 'Menus, popovers, sheets' },
  { cls: 'glass-tinted', name: 'Tinted', use: 'One prominent action' },
]
</script>

<template>
  <DocSection
    title="Materials"
    subtitle="Glass is reserved for the control layer. Content sits on plain surfaces underneath it."
  >
    <div
      class="relative grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 overflow-hidden rounded-xl p-8"
      style="
        background:
          radial-gradient(40% 60% at 20% 30%, var(--color-blue) 0%, transparent 70%),
          radial-gradient(40% 60% at 80% 70%, var(--color-orange) 0%, transparent 70%),
          radial-gradient(30% 50% at 55% 20%, var(--color-pink) 0%, transparent 70%),
          var(--color-surface);
      "
    >
      <div
        v-for="m in materials"
        :key="m.cls"
        :class="[
          m.cls,
          'flex h-36 flex-col justify-end gap-0.5 rounded-xl p-5',
          m.cls === 'glass-tinted' && 'text-on-accent',
        ]"
      >
        <span class="text-body font-semibold">{{ m.name }}</span>
        <span class="text-footnote opacity-80">{{ m.use }}</span>
      </div>
    </div>
    <p class="m-0 text-footnote text-label-secondary">
      Reduce Transparency, Increase Contrast and browsers without backdrop-filter get an opaque
      material automatically.
    </p>
  </DocSection>
</template>
