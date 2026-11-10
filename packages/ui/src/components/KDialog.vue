<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'

import { cn } from '../lib/cn'
import { describedByFallback, dialogClasses } from './dialog'

const {
  title,
  description,
  class: className,
} = defineProps<{
  title: string
  description?: string
  class?: string
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <!-- Reka handles the focus trap, Esc/backdrop close and returning focus to the trigger. -->
  <DialogRoot v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay :class="dialogClasses.overlay" />
      <div :class="dialogClasses.wrapper">
        <DialogContent
          v-bind="describedByFallback(!!description)"
          data-slot="dialog"
          :class="cn(dialogClasses.content, className)"
        >
          <slot name="media" />
          <div class="flex flex-col gap-2">
            <DialogTitle :class="dialogClasses.title">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" :class="dialogClasses.description">
              {{ description }}
            </DialogDescription>
          </div>
          <slot />
          <div v-if="$slots.footer" :class="dialogClasses.footer">
            <slot name="footer" />
          </div>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
