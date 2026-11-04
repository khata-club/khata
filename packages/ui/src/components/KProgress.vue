<script setup lang="ts">
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { computed, useId } from 'vue'

import { useCountUp } from '../composables/useCountUp'
import { cn } from '../lib/cn'

const {
  value,
  label,
  showValue = true,
  class: className,
} = defineProps<{
  /** 0–100. `null` shows the indeterminate sweep. */
  value: number | null
  label?: string
  /** Show the percentage (it counts toward the new value). */
  showValue?: boolean
  class?: string
}>()

const labelId = `k-progress-${useId()}`
const clamped = computed(() => (value == null ? null : Math.max(0, Math.min(100, value))))
const shown = useCountUp(() => clamped.value ?? 0, { duration: 600 })
</script>

<template>
  <div data-slot="progress" :class="cn('flex flex-col gap-3', className)">
    <div v-if="label || showValue" class="flex items-baseline justify-between gap-3">
      <span v-if="label" :id="labelId" class="text-base font-medium">{{ label }}</span>
      <span v-if="showValue" aria-hidden="true" class="text-xl font-bold tabular-nums">
        {{ clamped == null ? '—' : `${Math.round(shown)}%` }}
      </span>
    </div>
    <ProgressRoot
      :model-value="clamped"
      :max="100"
      :aria-labelledby="label ? labelId : undefined"
      class="relative h-3 overflow-hidden rounded-full bg-gray-200 shadow-recessed"
    >
      <ProgressIndicator
        class="absolute inset-y-0 left-0 rounded-full bg-primary shadow-primary-sm transition-[width,opacity] duration-(--duration-slow) ease-standard"
        :style="{ width: `${clamped ?? 0}%`, opacity: clamped == null ? 0 : 1 }"
      />
      <span
        v-if="clamped == null"
        aria-hidden="true"
        class="absolute inset-y-0 left-0 w-2/5 animate-ck-indeterminate rounded-full bg-primary"
      />
    </ProgressRoot>
  </div>
</template>
