<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  disabled = false,
  invalid = false,
  tone = 'green',
  name,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
  invalid?: boolean
  /** Track colour when on. Green is the platform default. */
  tone?: 'green' | 'accent'
  name?: string
  id?: string
  class?: string
}>()

const checked = defineModel<boolean>({ default: false })
</script>

<template>
  <SwitchRoot
    :id="id"
    v-model="checked"
    :disabled="disabled"
    :name="name"
    :aria-invalid="invalid || undefined"
    :data-invalid="invalid || undefined"
    data-slot="switch"
    :class="
      cn(
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-body text-label data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        className,
      )
    "
  >
    <span
      :class="[
        'relative h-[30px] w-[54px] flex-none rounded-full bg-fill transition-[background-color,box-shadow] duration-(--duration-slow) ease-smooth',
        'group-data-[invalid]:shadow-[inset_0_0_0_1.5px_var(--color-negative)]',
        tone === 'green'
          ? 'group-data-[state=checked]:bg-green'
          : 'group-data-[state=checked]:bg-accent',
      ]"
    >
      <!-- Pressing stretches the thumb toward the far side (a liquid "lean"); release springs it
           across. Width and position share the bouncy spring. -->
      <SwitchThumb
        class="absolute top-[2px] left-[2px] h-[26px] w-[26px] rounded-full bg-white shadow-thumb transition-[translate,width] duration-(--duration-spring) ease-bouncy group-active:w-[34px] data-[state=checked]:translate-x-[24px] group-active:data-[state=checked]:translate-x-[16px]"
      />
    </span>
    <span v-if="$slots.default" class="min-w-0 flex-1"><slot /></span>
  </SwitchRoot>
</template>
