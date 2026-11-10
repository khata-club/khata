<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  tone = 'default',
  disabled = false,
  class: className,
} = defineProps<{
  tone?: 'default' | 'danger'
  disabled?: boolean
  class?: string
}>()

defineEmits<{ select: [event: Event] }>()
</script>

<template>
  <DropdownMenuItem
    :disabled="disabled"
    :class="
      cn(
        'flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium outline-hidden select-none [&_svg]:size-[18px] [&_svg]:shrink-0',
        tone === 'danger'
          ? 'text-danger data-[highlighted]:bg-danger-subtle'
          : 'text-fg data-[highlighted]:bg-surface-recessed [&_svg]:text-fg-muted',
        'data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled',
        className,
      )
    "
    @select="$emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>
