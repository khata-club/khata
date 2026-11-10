<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  KAlert,
  KAlertDialog,
  KBadge,
  KButton,
  KCopyField,
  KKeyValue,
  KStatusPill,
  KTextField,
  useToast,
} from '@khata/ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'
import { hasPermission } from '@/lib/session'
import type { Domain, DnsRecord } from './types'

const props = defineProps<{ id: string }>()
const router = useRouter()
const qc = useQueryClient()
const { toast } = useToast()
const { project } = useCurrent()
const base = computed(() => `/api/projects/${project.value?.id}/domains/${props.id}`)

const domain = useQuery({
  queryKey: ['domain', () => props.id],
  enabled: computed(() => !!project.value),
  queryFn: () => http.get<Domain>(base.value),
})
const senders = useQuery({
  queryKey: ['domains', () => project.value?.id],
  enabled: computed(() => !!project.value),
  queryFn: () =>
    http
      .get<{ data: Domain[] }>(`/api/projects/${project.value!.id}/domains`)
      .then((r) => r.data.find((d) => d.id === props.id)?.senders ?? []),
})

const verifying = ref(false)
async function verify() {
  verifying.value = true
  try {
    const r = await http.post<{ status: string }>(`${base.value}/verify`)
    toast({
      title: r.status === 'verified' ? 'Domain verified' : 'Not verified yet',
      description:
        r.status === 'verified'
          ? undefined
          : 'DNS changes can take up to 72 hours. We keep checking automatically.',
      tone: r.status === 'verified' ? 'success' : 'neutral',
    })
    await qc.invalidateQueries({ queryKey: ['domain'] })
  } finally {
    verifying.value = false
  }
}

async function remove() {
  await http.del(base.value)
  await qc.invalidateQueries({ queryKey: ['domains'] })
  await router.replace({ name: 'domains' })
}

const senderEmail = ref('')
const senderError = ref<string>()
async function addSender() {
  senderError.value = undefined
  try {
    await http.post(`${base.value}/senders`, { email: senderEmail.value })
    senderEmail.value = ''
    await qc.invalidateQueries({ queryKey: ['domains'] })
  } catch (e) {
    senderError.value = e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Could not add sender.'
  }
}

const purposeLabel: Record<DnsRecord['purpose'], string> = {
  dkim: 'DKIM',
  mail_from_mx: 'MAIL FROM (MX)',
  mail_from_spf: 'SPF',
  dmarc: 'DMARC',
}
const summary = computed(() => {
  const d = domain.data.value
  if (!d) return []
  return [
    { key: 'status', label: 'Status', value: d.status },
    { key: 'dkim', label: 'DKIM', value: d.dkimStatus },
    {
      key: 'mailFrom',
      label: 'MAIL FROM',
      value: `${d.mailFromDomain} · ${d.mailFromStatus ?? 'pending'}`,
    },
    { key: 'spf', label: 'SPF alignment', value: d.spfStatus ?? 'not checked' },
    { key: 'dmarc', label: 'DMARC', value: d.dmarcStatus ?? 'not checked' },
    { key: 'region', label: 'Region', value: d.region },
  ]
})
</script>

<template>
  <section v-if="domain.data.value" class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-bold">{{ domain.data.value.name }}</h2>
      <KStatusPill :status="domain.data.value.status" />
      <span class="flex-1" />
      <KButton size="sm" variant="secondary" :loading="verifying" @click="verify"
        >Check now</KButton
      >
      <KAlertDialog
        v-if="hasPermission('domain', 'manage')"
        title="Remove this domain?"
        description="Sending from it stops immediately and its SES identity is deleted."
        confirm-label="Remove"
        @confirm="remove"
      >
        <template #trigger><KButton size="sm" variant="ghost">Remove</KButton></template>
      </KAlertDialog>
    </header>

    <KAlert
      v-if="domain.data.value.spfStatus === 'multiple'"
      tone="danger"
      title="Multiple SPF records"
      :dismissible="false"
    >
      {{ domain.data.value.mailFromDomain }} has more than one SPF record, which makes SPF fail.
      Keep exactly one.
    </KAlert>

    <KKeyValue :items="summary">
      <template #status="{ item }"><KStatusPill :status="String(item.value)" /></template>
    </KKeyValue>

    <section class="flex flex-col gap-3">
      <h3 class="text-lg font-semibold">DNS records</h3>
      <p class="text-sm text-fg-muted">
        Add these at your DNS provider. Dak checks every few minutes until they verify, then a few
        times a day to catch accidental changes.
      </p>
      <div
        v-for="r in domain.data.value.records"
        :key="`${r.purpose}-${r.name}`"
        class="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[140px_1fr_1fr]"
      >
        <div class="flex flex-col gap-1">
          <span class="font-semibold">{{ purposeLabel[r.purpose] }}</span>
          <span class="flex gap-1">
            <KBadge :dot="false"
              >{{ r.type }}<template v-if="r.priority"> · {{ r.priority }}</template></KBadge
            >
            <KBadge v-if="r.action === 'merge'" tone="warning" :dot="false">Edit existing</KBadge>
            <KBadge v-else-if="r.action === 'optional'" :dot="false">Optional</KBadge>
          </span>
        </div>
        <KCopyField label="Name" :value="r.name" />
        <KCopyField label="Value" :value="r.value" />
        <p v-if="r.note" class="text-sm text-fg-muted md:col-span-3">{{ r.note }}</p>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-lg font-semibold">Senders</h3>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="s in senders.data.value" :key="s.id" class="font-mono text-sm">{{ s.email }}</li>
      </ul>
      <form
        v-if="hasPermission('domain', 'manage')"
        class="flex flex-wrap items-end gap-3"
        @submit.prevent="addSender"
      >
        <KTextField
          v-model="senderEmail"
          class="min-w-64 flex-1"
          label="Add sender address"
          :placeholder="`hello@${domain.data.value.name}`"
          :status="senderError ? 'error' : 'default'"
          :message="senderError"
        />
        <KButton type="submit" size="sm">Add</KButton>
      </form>
    </section>
  </section>
</template>
