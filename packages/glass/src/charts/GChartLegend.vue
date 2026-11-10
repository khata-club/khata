<script setup lang="ts">
export interface LegendItem {
  label: string
  color: string
  /** Optional trailing value. */
  value?: string
  /** Swatch shape: dot (series), line (a line series), dashed (a reference line), band (a range). */
  shape?: 'square' | 'line' | 'dashed' | 'band'
}

defineProps<{ items: LegendItem[] }>()
</script>

<template>
  <div class="flex flex-wrap gap-x-4 gap-y-1.5">
    <span
      v-for="it in items"
      :key="it.label"
      class="inline-flex items-center gap-1.5 text-footnote text-label-secondary"
    >
      <span
        v-if="it.shape === 'line'"
        class="h-0.5 w-3.5 rounded-full"
        :style="{ background: it.color }"
      />
      <span
        v-else-if="it.shape === 'dashed'"
        class="h-0 w-3.5 border-t-2 border-dashed"
        :style="{ borderColor: it.color }"
      />
      <span
        v-else-if="it.shape === 'band'"
        class="h-2.5 w-3.5 rounded-[3px]"
        :style="{ background: it.color }"
      />
      <span v-else class="size-2 rounded-full" :style="{ background: it.color }" />
      <span class="text-label">{{ it.label }}</span
      ><span v-if="it.value" class="tabular-nums">{{ it.value }}</span>
    </span>
  </div>
</template>
