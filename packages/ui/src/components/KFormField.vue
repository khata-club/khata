<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from '@lucide/vue'
import { computed, useId } from 'vue'

import { cn } from '../lib/cn'
import KLabel from './KLabel.vue'

const {
  label,
  id: idProp,
  hint,
  error,
  success,
  required = false,
  optional = false,
  disabled = false,
  counter,
  hintIcon = false,
  class: className,
} = defineProps<{
  label: string
  /** Id for the control; generated when omitted. */
  id?: string
  /** Helper text shown under the control. */
  hint?: string
  /** Error message. When set the field is invalid and the message replaces the hint. */
  error?: string
  /** Positive confirmation, e.g. "Looks good." */
  success?: string
  required?: boolean
  optional?: boolean
  disabled?: boolean
  /** Right-aligned text beside the label, e.g. "12 / 32". */
  counter?: string
  /** Show an info icon before a plain hint. */
  hintIcon?: boolean
  class?: string
}>()

const autoId = useId()
const id = computed(() => idProp ?? `k-field-${autoId}`)
const messageId = computed(() => `${id.value}-message`)
// `||`, not `??`: an empty error string (`:error="errors.x || ''"`) must fall back to the hint.
const message = computed(() => error || success || hint)
const tone = computed(() => (error ? 'error' : success ? 'success' : 'hint'))

/** Spread onto the control: `<KInput v-bind="field" />`. */
const field = computed(() => ({
  id: id.value,
  'aria-describedby': message.value ? messageId.value : undefined,
  'aria-invalid': error ? true : undefined,
  'aria-required': required || undefined,
  required: required || undefined,
  invalid: !!error,
  disabled: disabled || undefined,
}))
</script>

<template>
  <div data-slot="form-field" :class="cn('flex min-w-0 flex-col gap-2', className)">
    <div class="flex items-baseline justify-between gap-3">
      <KLabel :for="id" :required="required" :optional="optional" :disabled="disabled">
        {{ label }}
      </KLabel>
      <span v-if="counter" class="font-mono text-xs text-fg-muted">{{ counter }}</span>
    </div>
    <slot :field="field" />
    <!-- Always mounted: screen readers often skip a live region inserted with its text already in
         it, so only the content toggles. `empty:-mt-2` cancels the column gap while it's empty. -->
    <span
      :id="messageId"
      aria-live="polite"
      :class="
        cn(
          'flex items-start gap-2 text-sm [text-wrap:pretty] empty:-mt-2',
          message && 'min-h-5',
          tone === 'error' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'hint' && 'text-fg-muted',
        )
      "
    >
      <template v-if="message">
        <CircleAlert
          v-if="tone === 'error'"
          :size="16"
          aria-hidden="true"
          class="mt-0.5 shrink-0"
        />
        <CircleCheck
          v-else-if="tone === 'success'"
          :size="16"
          aria-hidden="true"
          class="mt-0.5 shrink-0"
        />
        <Info v-else-if="hintIcon" :size="16" aria-hidden="true" class="mt-0.5 shrink-0" />
        <span>{{ message }}</span>
      </template>
    </span>
  </div>
</template>
