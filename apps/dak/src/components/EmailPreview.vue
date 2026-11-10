<script setup lang="ts">
import { KSegmentedControl } from '@khata/ui'
import { ref } from 'vue'

/**
 * Renders untrusted email HTML in a fully sandboxed iframe: no scripts, no same-origin
 * access, no forms or top navigation (spec §15: safe HTML preview sandbox).
 */
defineProps<{ html: string; title?: string }>()
const device = ref<'desktop' | 'mobile'>('desktop')
</script>

<template>
  <div class="flex flex-col gap-3">
    <KSegmentedControl
      v-model="device"
      size="sm"
      label="Preview width"
      :options="[
        { value: 'desktop', label: 'Desktop' },
        { value: 'mobile', label: 'Mobile' },
      ]"
    />
    <div class="flex justify-center rounded-lg border border-line bg-surface-recessed p-3">
      <iframe
        :title="title ?? 'Email preview'"
        sandbox=""
        referrerpolicy="no-referrer"
        :srcdoc="html"
        class="h-[560px] rounded-md border-0 bg-white shadow-raised-sm transition-[width] duration-(--duration-normal)"
        :class="device === 'mobile' ? 'w-[375px]' : 'w-full'"
      />
    </div>
  </div>
</template>
