<script setup lang="ts">
import { Check, ChevronsUpDown } from '@lucide/vue'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

import { cn } from '../lib/cn'

defineOptions({ inheritAttrs: false })

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const {
  options,
  placeholder = 'Select…',
  id,
  disabled = false,
  invalid = false,
  name,
  class: className,
} = defineProps<{
  options: SelectOption[]
  placeholder?: string
  /** Id for the trigger, so a `<GLabel for>` names it. */
  id?: string
  disabled?: boolean
  invalid?: boolean
  name?: string
  class?: string
}>()

const value = defineModel<string>()
</script>

<template>
  <SelectRoot v-model="value" :disabled="disabled" :name="name">
    <!-- A pop-up button: filled like a field, with the up/down chevrons. -->
    <SelectTrigger
      v-bind="$attrs"
      :id="id"
      :aria-invalid="invalid || undefined"
      data-slot="select"
      :class="
        cn(
          'group flex h-11 w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-fill-tertiary px-4 text-left text-body text-label outline-none',
          'transition-[background-color,box-shadow,scale] duration-(--duration-normal) ease-out hover:bg-fill-secondary active:scale-[0.99]',
          'focus-visible:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)] data-[state=open]:bg-fill-secondary',
          invalid && 'shadow-[inset_0_0_0_1.5px_var(--color-negative)]',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )
      "
    >
      <span
        v-if="$slots.icon"
        class="flex shrink-0 text-label-secondary [&_svg]:size-[18px]"
        aria-hidden="true"
      >
        <slot name="icon" />
      </span>
      <SelectValue
        :placeholder="placeholder"
        class="flex-1 truncate data-[placeholder]:text-label-secondary"
      />
      <ChevronsUpDown :size="16" aria-hidden="true" class="shrink-0 text-label-secondary" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        :collision-padding="12"
        class="z-50 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) origin-(--reka-select-content-transform-origin) overflow-hidden rounded-[22px] glass-thick p-1.5 data-[state=closed]:animate-g-pop-out data-[state=open]:animate-g-pop-in"
      >
        <SelectViewport class="flex flex-col">
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            :disabled="o.disabled"
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-[16px] pr-4 pl-2.5 text-body text-label outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-fill-tertiary"
          >
            <span class="grid w-5 shrink-0 place-items-center">
              <SelectItemIndicator>
                <Check :size="16" :stroke-width="2.75" aria-hidden="true" class="text-tint" />
              </SelectItemIndicator>
            </span>
            <SelectItemText>{{ o.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
