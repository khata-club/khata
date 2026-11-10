<script setup lang="ts">
import { computed, useId } from 'vue'

import KSegmentedControl from '../components/KSegmentedControl.vue'
import { type DateRangePreset, DEFAULT_PRESETS, isoDate, presetRange } from './dateRange'

export interface DateRange {
  /** Inclusive start, `YYYY-MM-DD`. */
  from: string
  /** Inclusive end, `YYYY-MM-DD`. */
  to: string
  /** Preset that produced the range, or `custom`. */
  preset: string
}

export type { DateRangePreset } from './dateRange'

const {
  presets = DEFAULT_PRESETS,
  label = 'Date range',
  today,
} = defineProps<{
  presets?: DateRangePreset[]
  label?: string
  /** Override "today" (`YYYY-MM-DD`) for tests and stories. */
  today?: string
}>()

const range = defineModel<DateRange>({ required: true })
const id = useId()

const options = computed(() => [
  ...presets.map((p) => ({ value: p.value, label: p.label })),
  { value: 'custom', label: 'Custom' },
])

function choosePreset(value: string | undefined) {
  if (!value) return
  if (value === 'custom') {
    range.value = { ...range.value, preset: 'custom' }
    return
  }
  const p = presets.find((x) => x.value === value)
  if (p) range.value = { ...presetRange(p.days, today ?? isoDate(new Date())), preset: p.value }
}

function setBound(bound: 'from' | 'to', value: string) {
  if (!value) return
  const next = { ...range.value, [bound]: value, preset: 'custom' }
  if (next.from > next.to) next[bound === 'from' ? 'to' : 'from'] = value
  range.value = next
}
</script>

<template>
  <fieldset data-slot="date-range" class="m-0 flex flex-wrap items-center gap-3 border-0 p-0">
    <legend class="sr-only">{{ label }}</legend>
    <KSegmentedControl
      size="sm"
      :model-value="range.preset"
      :options="options"
      :label="label"
      @update:model-value="choosePreset"
    />
    <div v-if="range.preset === 'custom'" class="flex items-center gap-2 text-sm">
      <label :for="`${id}-from`" class="sr-only">From</label>
      <input
        :id="`${id}-from`"
        type="date"
        :value="range.from"
        :max="range.to"
        class="h-10 rounded-md border border-line-control bg-surface px-2 text-sm"
        @change="setBound('from', ($event.target as HTMLInputElement).value)"
      />
      <span aria-hidden="true">–</span>
      <label :for="`${id}-to`" class="sr-only">To</label>
      <input
        :id="`${id}-to`"
        type="date"
        :value="range.to"
        :min="range.from"
        class="h-10 rounded-md border border-line-control bg-surface px-2 text-sm"
        @change="setBound('to', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </fieldset>
</template>
