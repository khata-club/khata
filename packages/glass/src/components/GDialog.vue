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
  <!-- Reka handles the focus trap, Esc/backdrop close and returning focus to the trigger.
       Narrow screens get a floating sheet that rises from the bottom; wider ones a centred
       panel that settles in from slightly larger. -->
  <DialogRoot v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[100] bg-(--backdrop) data-[state=closed]:animate-g-fade-out data-[state=open]:animate-g-fade-in"
      />
      <DialogContent
        data-slot="dialog"
        :class="
          cn(
            'fixed inset-x-2 bottom-2 z-[101] flex max-h-[calc(100dvh-16px)] flex-col gap-5 overflow-y-auto rounded-[34px] glass-thick px-6 pt-3 pb-6 text-label outline-none',
            'data-[state=closed]:animate-g-sheet-out data-[state=open]:animate-g-sheet-in',
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(460px,calc(100vw-48px))] sm:-translate-1/2 sm:rounded-[30px] sm:p-7',
            'sm:data-[state=closed]:animate-g-dialog-out sm:data-[state=open]:animate-g-dialog-in',
            className,
          )
        "
      >
        <span
          aria-hidden="true"
          class="mx-auto h-1.5 w-9 shrink-0 rounded-full bg-fill sm:hidden"
        />
        <slot name="media" />
        <div class="flex flex-col gap-1.5">
          <DialogTitle class="m-0 text-title-3 font-semibold">{{ title }}</DialogTitle>
          <DialogDescription
            v-if="description"
            class="m-0 text-subhead [text-wrap:pretty] text-label-secondary"
          >
            {{ description }}
          </DialogDescription>
        </div>
        <slot />
        <div
          v-if="$slots.footer"
          class="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:max-sm:w-full"
        >
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
