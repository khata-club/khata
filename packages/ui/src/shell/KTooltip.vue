<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'

const {
  content,
  side = 'top',
  delay = 300,
} = defineProps<{
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Hover delay in ms before opening. */
  delay?: number
}>()
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot>
      <TooltipTrigger as-child><slot /></TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :side-offset="6"
          data-slot="tooltip"
          class="z-50 max-w-xs rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-white shadow-floating"
        >
          {{ content }}
          <TooltipArrow class="fill-fg" :width="10" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
