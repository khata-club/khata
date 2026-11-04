<script setup lang="ts">
import { computed, useId } from 'vue'

import KLabel from '../components/KLabel.vue'
import { cn } from '../lib/cn'
import { messageColor } from './fieldStyles'
import type { FieldStatus } from './types'

defineOptions({ inheritAttrs: false })

const {
  label,
  id: idProp,
  status = 'default',
  message,
  hint,
  max,
  required = false,
  optional = false,
  disabled = false,
  readonly = false,
  rows = 4,
  class: className,
} = defineProps<{
  label: string
  id?: string
  status?: FieldStatus
  message?: string
  hint?: string
  /** Soft character limit: shows "n / max" and a fill bar coloured by status. */
  max?: number
  required?: boolean
  optional?: boolean
  disabled?: boolean
  readonly?: boolean
  rows?: number
  class?: string
}>()

const model = defineModel<string>({ default: '' })

const autoId = useId()
const id = computed(() => idProp ?? `k-textarea-${autoId}`)
const helpId = computed(() => `${id.value}-help`)
const help = computed(() => message ?? hint)
const pct = computed(() => (max ? Math.min(100, (model.value.length / max) * 100) : 0))
const barColor = computed(() =>
  status === 'error'
    ? 'bg-danger'
    : status === 'warning'
      ? 'bg-warning'
      : disabled
        ? 'bg-gray-300'
        : 'bg-primary-accent',
)
</script>

<template>
  <div data-slot="textarea" :class="cn('flex min-w-0 flex-col gap-2', className)">
    <div class="flex items-baseline justify-between gap-3">
      <KLabel :for="id" :required="required" :optional="optional" :disabled="disabled">{{
        label
      }}</KLabel>
      <span
        v-if="max"
        :class="cn('font-mono text-xs', messageColor[disabled ? 'disabled' : status])"
      >
        {{ model.length }} / {{ max }}
      </span>
    </div>
    <textarea
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="status === 'error' || undefined"
      :aria-required="required || undefined"
      :aria-describedby="help ? helpId : undefined"
      :class="
        cn(
          'min-h-[120px] w-full resize-y rounded-md border-[1.5px] px-4 py-3 text-base text-fg transition-[border-color,box-shadow,background-color] duration-(--duration-normal) ease-standard outline-none',
          status === 'error' &&
            'border-danger bg-surface shadow-recessed focus:shadow-recessed-danger-focus',
          status === 'warning' &&
            'border-warning bg-surface shadow-recessed focus:shadow-recessed-warning-focus',
          (status === 'default' || status === 'valid' || status === 'loading') &&
            'border-line-control bg-surface-subtle shadow-recessed hover:border-gray-600 focus:border-primary focus:bg-surface focus:shadow-recessed-focus',
          readonly && 'border-line bg-surface-subtle shadow-none',
          'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-control disabled:bg-surface-recessed disabled:text-fg-disabled disabled:shadow-none',
        )
      "
    />
    <div v-if="max" aria-hidden="true" class="h-1 overflow-hidden rounded-full bg-gray-200">
      <span
        :class="
          cn(
            'block h-full rounded-full transition-[width,background-color] duration-(--duration-slow) ease-standard',
            barColor,
          )
        "
        :style="{ width: `${pct}%` }"
      />
    </div>
    <span
      v-if="help"
      :id="helpId"
      aria-live="polite"
      :class="cn('min-h-5 text-sm', messageColor[disabled ? 'disabled' : status])"
    >
      {{ help }}
    </span>
  </div>
</template>
