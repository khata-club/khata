<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui'

import GButton from './GButton.vue'

const {
  title,
  description,
  confirmLabel = 'Confirm',
  loadingLabel,
  cancelLabel = 'Cancel',
  loading = false,
} = defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  /** Confirm button text while `loading` (announced; the spinner replaces it visually). */
  loadingLabel?: string
  cancelLabel?: string
  /** Keeps the dialog open with a spinner on the confirm button. */
  loading?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

function onConfirm(e: Event) {
  // Stay open: the parent closes the dialog (set open=false) once the action finishes.
  e.preventDefault()
  if (!loading) emit('confirm')
}
</script>

<template>
  <!-- A compact, centred alert for destructive confirmations. Focus starts on Cancel. -->
  <AlertDialogRoot v-model:open="open">
    <AlertDialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-[100] bg-(--backdrop) data-[state=closed]:animate-g-fade-out data-[state=open]:animate-g-fade-in"
      />
      <AlertDialogContent
        data-slot="alert-dialog"
        class="fixed top-1/2 left-1/2 z-[101] flex w-[min(320px,calc(100vw-48px))] -translate-1/2 flex-col gap-5 rounded-[30px] glass-thick p-5 pt-6 text-center text-label outline-none data-[state=closed]:animate-g-dialog-out data-[state=open]:animate-g-dialog-in"
      >
        <div class="flex flex-col gap-1.5 px-2">
          <AlertDialogTitle class="m-0 text-body font-semibold">{{ title }}</AlertDialogTitle>
          <AlertDialogDescription
            v-if="description"
            class="m-0 text-footnote [text-wrap:pretty] text-label-secondary"
          >
            {{ description }}
          </AlertDialogDescription>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <AlertDialogCancel as-child>
            <GButton variant="gray">{{ cancelLabel }}</GButton>
          </AlertDialogCancel>
          <AlertDialogAction as-child @click="onConfirm">
            <GButton variant="destructive" :loading="loading">
              {{ loading ? (loadingLabel ?? confirmLabel) : confirmLabel }}
            </GButton>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
