<script setup lang="ts">
import { KFormField, KSelect, type SelectOption } from '@khata/ui'

defineProps<{
  label: string
  options: SelectOption[]
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  optional?: boolean
}>()
const model = defineModel<string>()
</script>

<template>
  <KFormField
    v-slot="{ field }"
    :label="label"
    :error="error"
    :hint="hint"
    :required="required"
    :optional="optional"
  >
    <KSelect
      :id="field.id"
      v-model="model"
      :options="options"
      :placeholder="placeholder"
      :invalid="field.invalid"
      :aria-describedby="field['aria-describedby']"
    />
  </KFormField>
</template>
