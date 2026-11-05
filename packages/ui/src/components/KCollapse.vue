<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot } from 'reka-ui'

import { cn } from '../lib/cn'

const { class: className } = defineProps<{ class?: string }>()

/** Visible state. Closing collapses the height smoothly, then unmounts the content. */
const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <CollapsibleRoot v-model:open="open">
    <CollapsibleContent
      :class="
        cn(
          'overflow-hidden data-[state=closed]:animate-ck-collapse-up data-[state=open]:animate-ck-collapse-down',
          className,
        )
      "
    >
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
