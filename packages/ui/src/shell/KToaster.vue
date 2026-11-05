<script setup lang="ts">
import { X } from '@lucide/vue'
import {
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from 'reka-ui'

import { cn } from '../lib/cn'
import { useToast, type ToastTone } from './useToast'

const { label = 'Notifications' } = defineProps<{ label?: string }>()
const { toasts, dismiss } = useToast()

const tones: Record<ToastTone, string> = {
  neutral: 'border-line',
  success: 'border-success-border',
  warning: 'border-warning-border',
  danger: 'border-danger-border',
}
const bars: Record<ToastTone, string> = {
  neutral: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}
</script>

<template>
  <ToastProvider :label="label" swipe-direction="right">
    <ToastRoot
      v-for="t in toasts"
      :key="t.id"
      :duration="t.duration || Infinity"
      :type="t.tone === 'danger' ? 'foreground' : 'background'"
      data-slot="toast"
      :class="
        cn(
          'relative flex items-start gap-3 overflow-hidden rounded-lg border bg-surface py-3 pr-3 pl-4 shadow-floating',
          tones[t.tone],
        )
      "
      @update:open="(open: boolean) => !open && dismiss(t.id)"
    >
      <span :class="cn('absolute inset-y-0 left-0 w-1', bars[t.tone])" aria-hidden="true" />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastTitle class="text-sm font-semibold">{{ t.title }}</ToastTitle>
        <ToastDescription v-if="t.description" class="text-sm text-fg-muted">
          {{ t.description }}
        </ToastDescription>
      </div>
      <ToastClose
        aria-label="Dismiss"
        class="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-fg-muted hover:bg-surface-recessed"
      >
        <X :size="16" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed right-0 bottom-0 z-[60] m-0 flex w-[min(380px,100vw)] list-none flex-col gap-2 p-4 outline-none"
    />
  </ToastProvider>
</template>
