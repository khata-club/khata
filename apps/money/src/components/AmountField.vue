<script setup lang="ts">
import { KTextField } from '@khata/ui'
import { ref, watch } from 'vue'

import { formatINR, paiseToInput, parseAmount } from '#shared/money'

/** Rupee input that accepts "1,50,000", "1.5L", "12k"… and models integer paise. */
const props = defineProps<{
  label: string
  error?: string
  hint?: string
  required?: boolean
  optional?: boolean
  id?: string
  allowZero?: boolean
}>()
const model = defineModel<number | null>({ default: null })

const text = ref(model.value != null ? paiseToInput(model.value) : '')
const local = ref<string>()

watch(model, (v) => {
  if (v !== parseAmount(text.value)) text.value = v != null ? paiseToInput(v) : ''
})

function onInput(v: string) {
  text.value = v
  const p = parseAmount(v)
  local.value = v && p == null ? 'Enter an amount like 2500 or 1.5L' : undefined
  model.value = p
}

const preview = () => {
  const p = parseAmount(text.value)
  return p && /[a-z]/i.test(text.value) ? `= ${formatINR(p, { paise: p % 100 !== 0 })}` : props.hint
}
</script>

<template>
  <KTextField
    :id="id"
    :model-value="text"
    :label="label"
    :required="required"
    :optional="optional"
    inputmode="decimal"
    autocomplete="off"
    placeholder="0"
    :status="error || local ? 'error' : 'default'"
    :message="error ?? local"
    :hint="preview()"
    mono
    @update:model-value="onInput"
  >
    <template #leading><span class="font-semibold text-fg-muted">₹</span></template>
  </KTextField>
</template>
