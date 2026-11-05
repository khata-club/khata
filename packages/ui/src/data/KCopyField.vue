<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useId } from 'vue'

import { cn } from '../lib/cn'
import { useCopy } from './useCopy'

const {
  value,
  label,
  mono = true,
  class: className,
} = defineProps<{
  value: string
  label: string
  /** Monospace for keys, DNS records and IDs. */
  mono?: boolean
  class?: string
}>()

const id = useId()
const { copied, copy } = useCopy()
</script>

<template>
  <div data-slot="copy-field" :class="cn('flex flex-col gap-1.5', className)">
    <label :for="id" class="text-sm font-semibold">{{ label }}</label>
    <div
      class="flex items-center gap-1 rounded-md border border-line-control bg-surface-recessed py-1 pr-1 pl-3 shadow-recessed"
    >
      <input
        :id="id"
        :value="value"
        readonly
        :class="
          cn(
            'min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-fg outline-none',
            mono && 'font-mono',
          )
        "
        @focus="($event.target as HTMLInputElement).select()"
      />
      <button
        type="button"
        :aria-label="copied ? `${label} copied` : `Copy ${label}`"
        class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-fg-muted hover:bg-surface hover:text-fg"
        @click="copy(value)"
      >
        <Check v-if="copied" :size="16" class="text-success" aria-hidden="true" />
        <Copy v-else :size="16" aria-hidden="true" />
      </button>
    </div>
    <span class="sr-only" aria-live="polite">{{ copied ? 'Copied' : '' }}</span>
  </div>
</template>
