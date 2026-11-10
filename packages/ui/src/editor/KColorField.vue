<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useControlAttrs } from '../composables/useControlAttrs'
import { cn } from '../lib/cn'
import { parseHex, toHex } from '../lib/color'

defineOptions({ inheritAttrs: false })

/** Swatch + hex input. Accepts any `#rgb`/`#rrggbb`; emits normalised `#rrggbb`. */
const {
  label,
  disabled = false,
  id,
  class: className,
} = defineProps<{ label?: string; disabled?: boolean; id?: string; class?: string }>()

const value = defineModel<string>({ default: '#000000' })
const emit = defineEmits<{ commit: [value: string] }>()
const { root: rootAttrs, control: controlAttrs } = useControlAttrs()
const text = ref(value.value)
watch(value, (v) => (text.value = v))

function normalise(v: string): string | undefined {
  const rgb = parseHex(v.startsWith('#') ? v : `#${v}`)
  return rgb ? toHex(rgb) : undefined
}

function commitText() {
  const n = normalise(text.value.trim())
  if (n) {
    value.value = n
    emit('commit', n)
  }
  text.value = value.value
}

// <input type=color> only accepts #rrggbb (a short #abc would show black).
const pickerValue = computed(() => normalise(value.value) ?? '#000000')

function onPick(e: Event) {
  // The picker reports lowercase; normalise so both paths emit the same `#RRGGBB`.
  value.value = normalise((e.target as HTMLInputElement).value) ?? value.value
}
</script>

<template>
  <div
    v-bind="rootAttrs"
    data-slot="color-field"
    :class="
      cn(
        'flex h-7 min-w-0 items-center gap-1.5 rounded-sm border border-line bg-surface pl-1 text-xs focus-within:border-primary',
        disabled && 'pointer-events-none opacity-50',
        className,
      )
    "
  >
    <label
      class="relative size-5 flex-none cursor-pointer overflow-hidden rounded-[4px] border border-line"
    >
      <span class="absolute inset-0" :style="{ background: value }" />
      <input
        type="color"
        :value="pickerValue"
        :disabled="disabled"
        :aria-label="label ? `${label} picker` : 'Colour picker'"
        class="absolute inset-0 cursor-pointer opacity-0"
        @input="onPick"
        @change="emit('commit', value)"
      />
    </label>
    <input
      :id="id"
      v-model="text"
      :aria-label="label"
      v-bind="controlAttrs"
      :disabled="disabled"
      spellcheck="false"
      class="h-full w-full min-w-0 bg-transparent pr-2 font-mono uppercase outline-hidden"
      @blur="commitText"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />
  </div>
</template>
