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
    <!-- Thick glass that blooms out of its trigger (Reka's transform origin). -->
    <DropdownMenuContent
      :align="align"
      :side-offset="8"
      :collision-padding="12"
      :class="
        cn(
          'z-50 flex min-w-[220px] origin-(--reka-dropdown-menu-content-transform-origin) flex-col rounded-[22px] glass-thick p-1.5 outline-none',
          'data-[state=closed]:animate-g-pop-out data-[state=open]:animate-g-pop-in',
          className,
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
