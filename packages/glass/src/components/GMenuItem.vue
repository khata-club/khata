<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  tone = 'default',
  disabled = false,
  class: className,
} = defineProps<{
  tone?: 'default' | 'destructive'
  disabled?: boolean
  class?: string
}>()

defineEmits<{ select: [event: Event] }>()
</script>

<template>
  <!-- Label first, icon trailing — the platform's menu layout. -->
  <DropdownMenuItem
    :disabled="disabled"
    :class="
      cn(
        'flex min-h-11 cursor-pointer items-center justify-between gap-6 rounded-[16px] px-3.5 text-body outline-none select-none [&_svg]:size-[18px] [&_svg]:shrink-0',
        'transition-colors duration-(--duration-fast) data-[highlighted]:bg-fill-tertiary',
        tone === 'destructive' ? 'text-negative' : 'text-label',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        className,
      )
    "
    @select="$emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>
