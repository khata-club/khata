<script setup lang="ts">
import { X } from '@lucide/vue'

import { useEditor } from './useEditor'

const editor = useEditor()
const tone = {
  info: 'border-primary-soft bg-surface',
  success: 'border-success-border bg-surface',
  warning: 'border-warning-border bg-surface',
  danger: 'border-danger-border bg-surface',
}
const bar = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}
</script>

<template>
  <div
    class="pointer-events-none fixed right-4 bottom-4 z-[200] flex w-[380px] flex-col gap-2"
    aria-live="polite"
  >
    <div
      v-for="t in editor.ui.toasts"
      :key="t.id"
      class="pointer-events-auto relative flex animate-ck-rise gap-3 overflow-hidden rounded-md border p-3 pl-4 shadow-floating"
      :class="tone[t.severity]"
      :role="t.severity === 'danger' ? 'alert' : 'status'"
      :data-code="t.code"
    >
      <span class="absolute inset-y-0 left-0 w-1" :class="bar[t.severity]" />
      <div class="min-w-0 flex-1">
        <p class="m-0 text-sm font-bold">{{ t.title }}</p>
        <p class="m-0 mt-0.5 text-xs leading-relaxed text-fg-muted">{{ t.body }}</p>
        <button
          v-if="t.action"
          class="mt-2 cursor-pointer rounded-sm bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-hover"
          @click="() => (t.action!.run(), editor.dismiss(t.id))"
        >
          {{ t.action.label }}
        </button>
      </div>
      <button class="k-icon-btn -mt-1 -mr-1" aria-label="Dismiss" @click="editor.dismiss(t.id)">
        <X />
      </button>
    </div>
  </div>
</template>
