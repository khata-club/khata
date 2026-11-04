<script setup lang="ts">
import { DropdownMenuTrigger } from 'reka-ui'
</script>

<template>
  <!-- Wraps your own button (e.g. KButton) via asChild. -->
  <DropdownMenuTrigger as-child>
    <slot />
  </DropdownMenuTrigger>
</template>
