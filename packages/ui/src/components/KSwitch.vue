<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '../lib/cn'
import { choiceRootClass } from './choice'

const {
  disabled = false,
  invalid = false,
  name,
  value,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
  /** Error state: red ring and tint while off (also sets aria-invalid). */
  invalid?: boolean
  name?: string
  /** Submitted with the form when on (defaults to "on"). */
  value?: string
  id?: string
  class?: string
}>()

const checked = defineModel<boolean>({ default: false })

type SwitchState = 'off' | 'on' | 'invalid' | 'disabledOff' | 'disabledOn'

// Precedence is explicit here rather than left to the order Tailwind emits data-* variants in:
// disabled beats checked, and checked beats invalid.
const state = computed<SwitchState>(() => {
  if (disabled) return checked.value ? 'disabledOn' : 'disabledOff'
  if (checked.value) return 'on'
  return invalid ? 'invalid' : 'off'
})

// Off mirrors an unchecked KRadio: a white recessed well with a 3:1 outline and a grey dot.
const TRACK: Record<SwitchState, string> = {
  off: 'border-line-control bg-surface shadow-recessed',
  invalid: 'border-danger bg-danger-subtle shadow-recessed',
  on: 'border-primary bg-primary shadow-switch-on',
  disabledOff: 'border-dashed border-line-control bg-surface-recessed',
  disabledOn: 'border-control-disabled bg-control-disabled',
}

// The thumb is a smaller dot while off and grows to full size as it slides on.
const THUMB: Record<SwitchState, string> = {
  off: 'scale-75 bg-line-control',
  invalid: 'scale-75 bg-danger',
  on: 'translate-x-5.5 scale-100 bg-on-primary shadow-thumb',
  disabledOff: 'scale-75 bg-control-disabled-mark',
  disabledOn: 'translate-x-5.5 scale-100 bg-on-primary',
}
</script>

<template>
  <SwitchRoot
    :id="id"
    v-model="checked"
    :disabled="disabled"
    :name="name"
    :value="value"
    :aria-invalid="invalid || undefined"
    :data-invalid="invalid || undefined"
    data-slot="switch"
    :class="cn(choiceRootClass, className)"
  >
    <!-- 52×30 track; 1.5px border + 1.5px padding leaves 52 − 6 − 24 = 22px of thumb travel. -->
    <span
      data-slot="switch-track"
      :class="
        cn(
          'flex h-7.5 w-13 flex-none items-center rounded-full border-[1.5px] p-[1.5px] transition-[background-color,border-color,box-shadow] duration-(--duration-slow) ease-standard',
          TRACK[state],
        )
      "
    >
      <SwitchThumb
        :class="
          cn(
            'size-6 rounded-full transition-[translate,scale,background-color,box-shadow] duration-(--duration-slow) ease-standard',
            THUMB[state],
          )
        "
      />
    </span>
    <span v-if="$slots.default" class="min-w-0 flex-1"><slot /></span>
  </SwitchRoot>
</template>
