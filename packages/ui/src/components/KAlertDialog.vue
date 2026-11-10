<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui'

import { describedByFallback, dialogClasses } from './dialog'
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
  /**
   * The action is running: the confirm button shows a spinner, and Cancel, Esc and the backdrop
   * can't close the dialog. Set `open` to false yourself once the action finishes.
   */
  loading?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

// A plain button, not AlertDialogAction: Reka's action (a DialogClose) closes on click and ignores
// preventDefault, which would dismiss the dialog before `loading` could show.
function onConfirm() {
  if (!loading) emit('confirm')
}

function keepOpenWhileLoading(event: Event) {
  if (loading) event.preventDefault()
}
</script>

<template>
  <!-- Destructive confirmation. Focus starts on Cancel (the safe action). -->
  <AlertDialogRoot v-model:open="open">
    <AlertDialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay :class="dialogClasses.overlay" />
      <div :class="dialogClasses.wrapper">
        <AlertDialogContent
          v-bind="describedByFallback(!!description)"
          data-slot="alert-dialog"
          :class="dialogClasses.content"
          @escape-key-down="keepOpenWhileLoading"
        >
          <span
            class="grid size-[52px] place-items-center rounded-full bg-danger-subtle text-danger"
          >
            <TriangleAlert :size="24" aria-hidden="true" />
          </span>
          <div class="flex flex-col gap-2">
            <AlertDialogTitle :class="dialogClasses.title">{{ title }}</AlertDialogTitle>
            <AlertDialogDescription v-if="description" :class="dialogClasses.description">
              {{ description }}
            </AlertDialogDescription>
          </div>
          <div :class="dialogClasses.footer">
            <AlertDialogCancel as-child>
              <KButton variant="secondary" :disabled="loading">{{ cancelLabel }}</KButton>
            </AlertDialogCancel>
            <KButton variant="danger" :loading="loading" class="min-w-[150px]" @click="onConfirm">
              {{ loading ? (loadingLabel ?? confirmLabel) : confirmLabel }}
            </KButton>
          </div>
        </AlertDialogContent>
      </div>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
