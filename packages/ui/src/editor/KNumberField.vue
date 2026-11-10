<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useControlAttrs } from '../composables/useControlAttrs'
import { cn } from '../lib/cn'

defineOptions({ inheritAttrs: false })

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
  /**
   * Visible scrub handle and the input's accessible name. Without it, pass `aria-label` or
   * `aria-labelledby` (forwarded to the input).
   */
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

const { root: rootAttrs, control: controlAttrs } = useControlAttrs()

/** Pixels of horizontal drag per `step` while scrubbing the label. */
const PX_PER_STEP = 2

const text = ref('')
const editing = ref(false)
const scrubbing = ref(false)
/** Escape blurs the input; the blur must not commit what was typed. */
let cancelled = false

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
  const factor = Math.pow(10, precision)
  return Math.min(max, Math.max(min, Math.round(v * factor) / factor))
}

function commitText() {
  editing.value = false
  const typed = text.value
  text.value = display.value
  if (cancelled) {
    cancelled = false
    return
  }
  // Focusing and leaving without typing must not round the model or add an undo step.
  if (typed === display.value) return
  const n = Number.parseFloat(typed)
  if (!Number.isFinite(n)) return
  const next = clampRound(n)
  if (next === value.value) return
  value.value = next
  emit('commit', next)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  else if (e.key === 'Escape') {
    cancelled = true
    ;(e.target as HTMLInputElement).blur()
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    // Step from what's typed, so a half-typed value isn't thrown away.
    const typed = Number.parseFloat(text.value)
    const base = Number.isFinite(typed) ? typed : value.value
    value.value = clampRound(base + (e.key === 'ArrowUp' ? 1 : -1) * step * mult)
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
  const v = clampRound(startValue + ((e.clientX - startX) / PX_PER_STEP) * step * mult)
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
    v-bind="rootAttrs"
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
      role="spinbutton"
      :aria-label="label"
      :aria-valuenow="Number.isFinite(value) ? value : undefined"
      :aria-valuemin="Number.isFinite(min) ? min : undefined"
      :aria-valuemax="Number.isFinite(max) ? max : undefined"
      :aria-valuetext="suffix ? `${display} ${suffix}` : undefined"
      v-bind="controlAttrs"
      :disabled="disabled"
      inputmode="decimal"
      class="h-full w-full min-w-0 bg-transparent px-1.5 text-right font-mono tabular-nums outline-hidden"
      @focus="editing = true"
      @blur="commitText"
      @keydown="onKey"
    />
    <span v-if="suffix" class="flex-none pr-2 text-fg-muted">{{ suffix }}</span>
  </div>
</template>
