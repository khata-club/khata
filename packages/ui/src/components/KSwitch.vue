<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  disabled = false,
  name,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
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
    data-slot="switch"
    :class="
      cn(
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent p-0 text-left text-base text-fg data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled',
        className,
      )
    "
  >
    <span
      class="relative h-[30px] w-[52px] flex-none rounded-full bg-gray-450 shadow-recessed transition-[background-color,box-shadow] duration-(--duration-slow) ease-standard group-data-[disabled]:bg-primary-soft group-data-[state=checked]:bg-primary group-data-[state=checked]:shadow-switch-on group-data-[disabled]:group-data-[state=checked]:bg-primary-soft group-data-[disabled]:group-data-[state=checked]:shadow-none"
    >
      <SwitchThumb
        class="absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-thumb transition-transform duration-(--duration-slow) ease-standard data-[state=checked]:translate-x-[22px]"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </SwitchRoot>
</template>
