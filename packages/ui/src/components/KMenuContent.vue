<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuPortal } from 'reka-ui'

import { cn } from '../lib/cn'

const { align = 'end', class: className } = defineProps<{
  align?: 'start' | 'center' | 'end'
  class?: string
}>()
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      :align="align"
      :side-offset="8"
      :class="
        cn(
          'z-(--z-popover) flex w-[196px] origin-(--reka-dropdown-menu-content-transform-origin) flex-col gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-floating data-[state=closed]:animate-ck-pop-out data-[state=open]:animate-ck-pop-in',
          className,
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
