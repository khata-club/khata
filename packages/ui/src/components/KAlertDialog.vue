<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
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

import KButton from './KButton.vue'

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
  /** Confirm button text while `loading`. */
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
  <!-- Destructive confirmation. Focus starts on Cancel (the safe action). -->
  <AlertDialogRoot v-model:open="open">
    <AlertDialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-[100] bg-(--backdrop) backdrop-blur-[3px] data-[state=closed]:animate-ck-fade-out data-[state=open]:animate-ck-fade-in"
      />
      <div class="pointer-events-none fixed inset-0 z-[101] grid place-items-center p-6">
        <AlertDialogContent
          class="pointer-events-auto flex w-full max-w-[440px] flex-col gap-5 rounded-2xl border border-line bg-surface p-8 shadow-floating outline-none data-[state=closed]:animate-ck-dialog-out data-[state=open]:animate-ck-dialog-in"
        >
          <span
            class="grid size-[52px] place-items-center rounded-full bg-danger-subtle text-danger"
          >
            <TriangleAlert :size="24" aria-hidden="true" />
          </span>
          <div class="flex flex-col gap-2">
            <AlertDialogTitle class="m-0 text-2xl font-semibold">{{ title }}</AlertDialogTitle>
            <AlertDialogDescription
              v-if="description"
              class="m-0 text-base [text-wrap:pretty] text-fg-muted"
            >
              {{ description }}
            </AlertDialogDescription>
          </div>
          <div class="mt-2 flex flex-wrap justify-end gap-3">
            <AlertDialogCancel as-child>
              <KButton variant="secondary">{{ cancelLabel }}</KButton>
            </AlertDialogCancel>
            <AlertDialogAction as-child @click="onConfirm">
              <KButton variant="danger" :loading="loading" class="min-w-[150px]">
                {{ loading ? (loadingLabel ?? confirmLabel) : confirmLabel }}
              </KButton>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </div>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
