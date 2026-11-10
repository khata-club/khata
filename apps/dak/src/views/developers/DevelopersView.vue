<script setup lang="ts">
import { KTabs } from '@khata/ui'

import ApiKeysTab from './ApiKeysTab.vue'
import WebhooksTab from './WebhooksTab.vue'

const tabs = [
  { value: 'keys', label: 'API keys' },
  { value: 'webhooks', label: 'Webhooks' },
]
</script>

<template>
  <KTabs :items="tabs" label="Developers">
    <template #keys><ApiKeysTab /></template>
    <template #webhooks><WebhooksTab /></template>
  </KTabs>
</template>
