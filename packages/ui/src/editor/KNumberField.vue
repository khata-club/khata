<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { cn } from '../lib/cn'

/**
 * Dense numeric field for inspectors. Drag the label horizontally to scrub the value (Shift = ×10,
 * Alt = ×0.1), or type a value and press Enter. `commit` fires once at the end of a gesture so
 * callers can close an undo step.
 */
const {
  label,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  precision = 0,
  suffix,
  disabled = false,
  id,
  class: className,
} = defineProps<{
  label?: string
  min?: number
  max?: number
  step?: number
  /** Decimal places shown. */
  precision?: number
  suffix?: string
  disabled?: boolean
  id?: string
  class?: string
}>()

const value = defineModel<number>({ default: 0 })
const emit = defineEmits<{ commit: [value: number] }>()

const text = ref('')
const editing = ref(false)
const scrubbing = ref(false)

const display = computed(() =>
  Number.isFinite(value.value) ? value.value.toFixed(precision) : '—',
)
watch(
  display,
  (d) => {
    if (!editing.value) text.value = d
  },
  { immediate: true },
)

function clampRound(v: number): number {
  const f = Math.pow(10, precision)
  return Math.min(max, Math.max(min, Math.round(v * f) / f))
}

function commitText() {
  editing.value = false
  const n = Number.parseFloat(text.value)
  if (Number.isFinite(n)) {
    value.value = clampRound(n)
    emit('commit', value.value)
  }
  text.value = display.value
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  else if (e.key === 'Escape') {
    editing.value = false
    text.value = display.value
    ;(e.target as HTMLInputElement).blur()
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    value.value = clampRound(value.value + (e.key === 'ArrowUp' ? 1 : -1) * step * mult)
    text.value = display.value
    emit('commit', value.value)
  }
}

let startX = 0
let startValue = 0
function onScrubDown(e: PointerEvent) {
  if (disabled || e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  startX = e.clientX
  startValue = value.value
  scrubbing.value = true
}
function onScrubMove(e: PointerEvent) {
  if (!scrubbing.value) return
  const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
  const v = clampRound(startValue + ((e.clientX - startX) / 2) * step * mult)
  if (v !== value.value) value.value = v
}
function onScrubUp(e: PointerEvent) {
  if (!scrubbing.value) return
  scrubbing.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  if (value.value !== startValue) emit('commit', value.value)
}
</script>

<template>
  <div
    data-slot="number-field"
    :class="
      cn(
        'flex h-7 min-w-0 items-center overflow-hidden rounded-sm border border-line bg-surface text-xs text-fg focus-within:border-primary',
        disabled && 'pointer-events-none opacity-50',
        className,
      )
    "
  >
    <span
      v-if="label"
      class="flex h-full flex-none cursor-ew-resize items-center px-2 font-semibold text-fg-muted select-none hover:text-primary"
      :class="scrubbing && 'text-primary'"
      aria-hidden="true"
      @pointerdown="onScrubDown"
      @pointermove="onScrubMove"
      @pointerup="onScrubUp"
      @pointercancel="onScrubUp"
      >{{ label }}</span
    >
    <input
      :id="id"
      v-model="text"
      :aria-label="label"
      :disabled="disabled"
      inputmode="decimal"
      class="h-full w-full min-w-0 bg-transparent px-1.5 text-right font-mono tabular-nums outline-none"
      @focus="editing = true"
      @blur="commitText"
      @keydown="onKey"
    />
    <span v-if="suffix" class="flex-none pr-2 text-fg-muted">{{ suffix }}</span>
  </div>
</template>
