<script setup lang="ts">
import { computed, useId } from 'vue'

import GLabel from '../components/GLabel.vue'
import { cn } from '../lib/cn'
import { messageColor, wellClasses } from './fieldStyles'
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
  /** Soft character limit: shows "n / max" and a thin fill bar coloured by status. */
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
const id = computed(() => idProp ?? `g-textarea-${autoId}`)
const helpId = computed(() => `${id.value}-help`)
const help = computed(() => message ?? hint)
const pct = computed(() => (max ? Math.min(100, (model.value.length / max) * 100) : 0))
const barColor = computed(() =>
  status === 'error' ? 'bg-negative' : status === 'warning' ? 'bg-orange' : 'bg-accent',
)
</script>

<template>
  <div data-slot="textarea" :class="cn('flex min-w-0 flex-col gap-1.5', className)">
    <div class="flex items-baseline justify-between gap-3">
      <GLabel :for="id" :required="required" :optional="optional" :disabled="disabled">{{
        label
      }}</GLabel>
      <span
        v-if="max"
        :class="cn('text-footnote tabular-nums', messageColor[disabled ? 'disabled' : status])"
      >
        {{ model.length }} / {{ max }}
      </span>
    </div>
    <div :class="cn(wellClasses(status, disabled, readonly), 'flex-col items-stretch')">
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
        class="min-h-[112px] w-full resize-y border-0 bg-transparent px-4 py-3 text-body text-inherit outline-none disabled:cursor-not-allowed"
      />
      <div v-if="max" aria-hidden="true" class="mx-4 mb-3 h-1 overflow-hidden rounded-full bg-fill">
        <span
          :class="
            cn(
              'block h-full rounded-full transition-[width,background-color] duration-(--duration-spring) ease-smooth',
              barColor,
            )
          "
          :style="{ width: `${pct}%` }"
        />
      </div>
    </div>
    <span
      v-if="help"
      :id="helpId"
      aria-live="polite"
      :class="cn('min-h-[18px] px-1 text-footnote', messageColor[disabled ? 'disabled' : status])"
    >
      {{ help }}
    </span>
  </div>
</template>
