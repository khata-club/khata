<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { KAlert, KButton, KCheckbox, KDialog, KStatusPill, KTextField } from '@khata/ui'
import { ref } from 'vue'

import { api } from '@/lib/api'
import { hasPermission } from '@/lib/session'

interface Grant {
  id: string
  supportUserId: string
  reason: string
  includeBodies: boolean
  expiresAt: number
  active: boolean
}

const qc = useQueryClient()
const grants = useQuery({
  queryKey: ['support-grants'],
  queryFn: () => api<{ data: Grant[] }>('/api/support-grants').then((r) => r.data),
})

const open = ref(false)
const supportUserId = ref('')
const reason = ref('')
const hours = ref('4')
const includeBodies = ref(false)

async function grant() {
  await api('/api/support-grants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      supportUserId: supportUserId.value,
      reason: reason.value,
      hours: Number(hours.value),
      includeBodies: includeBodies.value,
    }),
  })
  open.value = false
  await qc.invalidateQueries({ queryKey: ['support-grants'] })
}

async function revoke(id: string) {
  await api(`/api/support-grants/${id}`, { method: 'DELETE' })
  await qc.invalidateQueries({ queryKey: ['support-grants'] })
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <KAlert
      tone="primary"
      title="Dak staff cannot see your data unless you grant access here."
      :dismissible="false"
    >
      Grants expire automatically (72 hours at most) and every access is recorded in the audit log.
    </KAlert>
    <div v-if="hasPermission('support', 'grant')">
      <KDialog v-model:open="open" title="Grant support access">
        <template #trigger><KButton size="sm">Grant access</KButton></template>
        <form id="grant" class="flex flex-col gap-4" @submit.prevent="grant">
          <KTextField v-model="supportUserId" label="Support engineer ID" mono required />
          <KTextField v-model="reason" label="Reason" required hint="Quote the ticket number." />
          <KTextField
            v-model="hours"
            label="Duration (hours)"
            type="number"
            min="1"
            max="72"
            required
          />
          <label v-if="hasPermission('emailBody', 'read')" class="flex items-center gap-2 text-sm">
            <KCheckbox v-model="includeBodies" /> Include email bodies and attachments
          </label>
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">Cancel</KButton>
          <KButton type="submit" form="grant">Grant</KButton>
        </template>
      </KDialog>
    </div>
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="g in grants.data.value"
        :key="g.id"
        class="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-4 py-3"
      >
        <KStatusPill :status="g.active ? 'active' : 'expired'" />
        <span class="font-mono text-sm">{{ g.supportUserId }}</span>
        <span class="flex-1 text-sm text-fg-muted">{{ g.reason }}</span>
        <span class="text-xs text-fg-muted"
          >until {{ new Date(g.expiresAt).toLocaleString() }}</span
        >
        <KButton
          v-if="g.active && hasPermission('support', 'grant')"
          size="sm"
          variant="outline"
          @click="revoke(g.id)"
        >
          Revoke
        </KButton>
      </li>
    </ul>
  </section>
</template>
