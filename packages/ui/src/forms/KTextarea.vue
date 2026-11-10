<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

import KLabel from '../components/KLabel.vue'
import { cn } from '../lib/cn'
import { joinIds } from './aria'
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
  hideRequiredMark = false,
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
  /** Required for submission: sets `aria-required` and shows the asterisk. */
  required?: boolean
  /**
   * Keep `required` semantics but hide the asterisk, e.g. in forms that mark optional fields
   * instead of required ones.
   */
  hideRequiredMark?: boolean
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
const help = computed(() => message || hint)
const counterId = computed(() => `${id.value}-count`)
// Screen readers hear the limit too, plus any description the caller passed.
const attrs = useAttrs()
const describedBy = computed(() =>
  joinIds(
    attrs['aria-describedby'],
    max ? counterId.value : undefined,
    help.value ? helpId.value : undefined,
  ),
)
const pct = computed(() => (max ? Math.min(100, (model.value.length / max) * 100) : 0))
const barColor = computed(() =>
  status === 'error'
    ? 'bg-danger'
    : status === 'warning'
      ? 'bg-warning'
      : disabled
        ? 'bg-control-disabled'
        : 'bg-primary-accent',
)
</script>

<template>
  <div data-slot="textarea" :class="cn('flex min-w-0 flex-col gap-2', className)">
    <div class="flex items-baseline justify-between gap-3">
      <KLabel
        :for="id"
        :required="required && !hideRequiredMark"
        :optional="optional"
        :disabled="disabled"
        >{{ label }}</KLabel
      >
      <span
        v-if="max"
        :id="counterId"
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
      :aria-busy="status === 'loading' || undefined"
      :aria-required="required || undefined"
      :aria-describedby="describedBy"
      :class="
        cn(
          'min-h-[120px] w-full resize-y rounded-md border-[1.5px] px-4 py-3 text-base text-fg outline-hidden transition-[border-color,box-shadow,background-color] duration-(--duration-normal) ease-standard',
          status === 'error' &&
            'border-danger bg-surface shadow-recessed focus:shadow-recessed-danger-focus',
          status === 'warning' &&
            'border-warning bg-surface shadow-recessed focus:shadow-recessed-warning-focus',
          status === 'valid' &&
            'border-success bg-surface shadow-recessed focus:border-primary focus:shadow-recessed-focus',
          (status === 'default' || status === 'loading') &&
            'border-line-control bg-surface-subtle shadow-recessed hover:border-line-control-hover focus:border-primary focus:bg-surface focus:shadow-recessed-focus',
          readonly && 'bg-surface-subtle shadow-none focus:bg-surface-subtle focus:shadow-none',
          readonly && (status === 'default' || status === 'loading') && 'border-line',
          'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-control disabled:bg-surface-recessed disabled:text-fg-disabled disabled:shadow-none',
        )
      "
    />
    <div v-if="max" aria-hidden="true" class="h-1 overflow-hidden rounded-full bg-line">
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
    <!-- Always mounted so the first message is announced; `empty:-mt-2` hides the gap. -->
    <span
      :id="helpId"
      aria-live="polite"
      :class="
        cn('text-sm empty:-mt-2', help && 'min-h-5', messageColor[disabled ? 'disabled' : status])
      "
      >{{ help }}</span
    >
  </div>
</template>
