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
      <DialogOverlay
        class="fixed inset-0 z-[100] bg-(--backdrop) backdrop-blur-[3px] data-[state=closed]:animate-ck-fade-out data-[state=open]:animate-ck-fade-in"
      />
      <div class="pointer-events-none fixed inset-0 z-[101] grid place-items-center p-6">
        <DialogContent
          :class="
            cn(
              'pointer-events-auto flex w-full max-w-[440px] flex-col gap-5 rounded-2xl border border-line bg-surface p-8 shadow-floating outline-none data-[state=closed]:animate-ck-dialog-out data-[state=open]:animate-ck-dialog-in',
              className,
            )
          "
        >
          <slot name="media" />
          <div class="flex flex-col gap-2">
            <DialogTitle class="m-0 text-2xl font-semibold">{{ title }}</DialogTitle>
            <DialogDescription
              v-if="description"
              class="m-0 text-base [text-wrap:pretty] text-fg-muted"
            >
              {{ description }}
            </DialogDescription>
          </div>
          <slot />
          <div v-if="$slots.footer" class="mt-2 flex flex-wrap justify-end gap-3">
            <slot name="footer" />
          </div>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
