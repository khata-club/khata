<script setup lang="ts">
import { KTabs } from '@khata/ui'

import ApiKeysTab from './ApiKeysTab.vue'

const tabs = [{ value: 'keys', label: 'API keys' }]
</script>

<template>
  <KTabs :items="tabs" label="Developers">
    <template #keys><ApiKeysTab /></template>
  </KTabs>
</template>
