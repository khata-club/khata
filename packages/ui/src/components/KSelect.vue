<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
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
  /** Id for the trigger, so a `<KLabel for>` names it. */
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
    <SelectTrigger
      v-bind="$attrs"
      :id="id"
      :aria-invalid="invalid || undefined"
      data-slot="select"
      :class="
        cn(
          'group flex h-[52px] w-full cursor-pointer items-center gap-3 rounded-md border-[1.5px] border-line bg-surface px-4 text-left text-base text-fg shadow-raised-sm transition-[box-shadow,border-color] duration-(--duration-normal) ease-standard outline-none',
          'hover:shadow-raised focus-visible:border-primary data-[state=open]:border-primary',
          invalid && 'border-danger',
          'data-[disabled]:cursor-not-allowed data-[disabled]:border-dashed data-[disabled]:border-line-control data-[disabled]:bg-surface-recessed data-[disabled]:text-fg-disabled data-[disabled]:shadow-none',
          className,
        )
      "
    >
      <span
        v-if="$slots.icon"
        class="flex shrink-0 text-fg-muted [&_svg]:size-5"
        aria-hidden="true"
      >
        <slot name="icon" />
      </span>
      <SelectValue
        :placeholder="placeholder"
        class="flex-1 truncate font-medium data-[placeholder]:text-fg-muted"
      />
      <ChevronDown
        :size="20"
        aria-hidden="true"
        class="shrink-0 text-fg-muted transition-transform duration-(--duration-slow) ease-standard group-data-[state=open]:rotate-180"
      />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="8"
        class="z-50 w-(--reka-select-trigger-width) origin-(--reka-select-content-transform-origin) rounded-lg border border-line bg-surface p-1.5 shadow-floating data-[state=closed]:animate-ck-pop-out data-[state=open]:animate-ck-pop-in"
      >
        <SelectViewport class="flex flex-col gap-0.5">
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            :disabled="o.disabled"
            class="group/item flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-md px-3 text-base font-medium text-fg outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled data-[highlighted]:bg-surface-recessed data-[state=checked]:bg-primary-subtle data-[state=checked]:font-semibold data-[state=checked]:text-primary-pressed"
          >
            <SelectItemText class="flex-1">{{ o.label }}</SelectItemText>
            <SelectItemIndicator force-mount>
              <Check
                :size="18"
                aria-hidden="true"
                class="scale-60 text-primary opacity-0 transition-[opacity,transform] duration-(--duration-normal) ease-standard group-data-[state=checked]/item:scale-100 group-data-[state=checked]/item:opacity-100"
              />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
