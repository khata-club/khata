<script setup lang="ts">
const { type = 'button', disabled = false } = defineProps<{
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}>()
</script>

<template>
  <button :type="type" :disabled="disabled">
    <slot />
  </button>
</template>
