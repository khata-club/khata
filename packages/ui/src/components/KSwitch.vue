<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  disabled = false,
  invalid = false,
  name,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
  invalid?: boolean
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
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent p-0 text-left text-base text-fg data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled',
        className,
      )
    "
  >
    <span
      class="relative h-[30px] w-[52px] flex-none rounded-full bg-gray-450 shadow-recessed transition-[background-color,box-shadow] duration-(--duration-slow) ease-standard group-data-[disabled]:bg-surface-recessed group-data-[disabled]:shadow-[inset_0_0_0_1.5px_var(--color-gray-200)] group-data-[invalid]:bg-danger-subtle group-data-[invalid]:shadow-[inset_0_0_0_1.5px_var(--color-danger)] group-data-[state=checked]:bg-primary group-data-[state=checked]:shadow-switch-on group-data-[disabled]:group-data-[state=checked]:bg-gray-300 group-data-[disabled]:group-data-[state=checked]:shadow-none"
    >
      <SwitchThumb
        class="absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-thumb transition-transform duration-(--duration-slow) ease-standard group-data-[disabled]:bg-gray-50 group-data-[disabled]:shadow-[0_1px_2px_rgb(32_52_93/0.1)] data-[state=checked]:translate-x-[22px]"
      />
    </span>
    <span v-if="$slots.default" class="min-w-0 flex-1"><slot /></span>
  </SwitchRoot>
</template>
