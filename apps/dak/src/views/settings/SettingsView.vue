<script setup lang="ts">
import { KTabs } from '@khata/ui'
import { computed } from 'vue'

import { hasPermission } from '@/lib/session'
import AuditTab from './AuditTab.vue'
import MembersTab from './MembersTab.vue'
import ProjectsTab from './ProjectsTab.vue'
import SupportTab from './SupportTab.vue'

const tabs = computed(() => [
  { value: 'projects', label: 'Projects' },
  { value: 'members', label: 'Members' },
  ...(hasPermission('audit', 'read')
    ? [
        { value: 'audit', label: 'Audit log' },
        { value: 'support', label: 'Support access' },
      ]
    : []),
])
</script>

<template>
  <KTabs :items="tabs" label="Settings">
    <template #projects><ProjectsTab /></template>
    <template #members><MembersTab /></template>
    <template #audit><AuditTab /></template>
    <template #support><SupportTab /></template>
  </KTabs>
</template>
