<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  KAlert,
  KAlertDialog,
  KButton,
  KCopyField,
  KDialog,
  KEmptyState,
  KSelect,
  KStatusPill,
  KTextField,
  useToast,
} from '@khata/ui'
import { CircleCheck, CircleAlert, Cloud, ExternalLink } from '@lucide/vue'
import { computed, ref } from 'vue'

import { api, ApiError } from '@/lib/api'
import { useProjects } from '@/lib/context'
import { hasPermission } from '@/lib/session'

interface Check {
  id: string
  label: string
  ok: boolean
  detail?: string
}
interface Connection {
  id: string
  mode: 'platform' | 'byo'
  region: string
  accountId: string | null
  roleArn: string | null
  status: string
  health: { ok: boolean; checks: Check[] } | null
  checkedAt: number | null
}

const qc = useQueryClient()
const { toast } = useToast()
const projects = useProjects()
const connections = useQuery({
  queryKey: ['aws-connections'],
  queryFn: () => api<{ data: Connection[] }>('/api/aws-connections').then((r) => r.data),
})

const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

// Wizard
const open = ref(false)
const step = ref<1 | 2 | 3>(1)
const region = ref('eu-west-1')
const created = ref<{ id: string; externalId: string; launchUrl: string }>()
const roleArn = ref('')
const verifying = ref(false)
const verified = ref<Connection & { health: { ok: boolean; checks: Check[] } }>()
const wizardError = ref<string>()

function reset() {
  step.value = 1
  created.value = undefined
  roleArn.value = ''
  verified.value = undefined
  wizardError.value = undefined
}

async function create() {
  created.value = await post('/api/aws-connections', { region: region.value })
  step.value = 2
  await qc.invalidateQueries({ queryKey: ['aws-connections'] })
}

async function verify() {
  verifying.value = true
  wizardError.value = undefined
  try {
    verified.value = await post(`/api/aws-connections/${created.value!.id}/verify`, {
      roleArn: roleArn.value,
    })
    step.value = 3
  } catch (e) {
    wizardError.value = e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Verification failed.'
  } finally {
    verifying.value = false
    await qc.invalidateQueries({ queryKey: ['aws-connections'] })
  }
}

const byoProjects = computed(
  () =>
    projects.data.value
      ?.filter((p) => p.infrastructureMode === 'byo')
      .map((p) => ({ value: p.id, label: `${p.name} · ${p.region}` })) ?? [],
)
const attachTo = ref<string>()

async function attach(connectionId: string) {
  try {
    await post(`/api/aws-connections/${connectionId}/attach`, { projectId: attachTo.value })
    toast({ title: 'Project now sends through your AWS account', tone: 'success' })
    open.value = false
    await qc.invalidateQueries({ queryKey: ['projects'] })
  } catch (e) {
    toast({
      title: 'Could not attach',
      description: e instanceof ApiError ? e.code : undefined,
      tone: 'danger',
    })
  }
}

async function recheck(id: string) {
  await post(`/api/aws-connections/${id}/check`)
  await qc.invalidateQueries({ queryKey: ['aws-connections'] })
}

async function disconnect(id: string) {
  const res = await post<{ status: string }>(`/api/aws-connections/${id}/disconnect`)
  toast({
    title: res.status === 'disconnected' ? 'Disconnected' : 'Disconnecting',
    description:
      res.status === 'disconnected'
        ? 'Dak no longer uses this role. You can delete the stack in AWS.'
        : 'New sends are stopped. Dak will finish accepted work, then release the role.',
  })
  await qc.invalidateQueries({ queryKey: ['aws-connections'] })
}

const regions = [
  'eu-west-1',
  'eu-central-1',
  'us-east-1',
  'us-west-2',
  'ap-south-1',
  'ap-southeast-2',
].map((r) => ({ value: r, label: r }))
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-sm text-fg-muted">
        Send through SES in your own AWS account. You pay AWS directly and keep your sending
        reputation; Dak assumes a narrowly scoped role and never stores long-lived keys.
      </p>
      <KDialog
        v-if="hasPermission('infrastructure', 'manage')"
        v-model:open="open"
        title="Connect your AWS account"
        @update:open="(v: boolean) => v && reset()"
      >
        <template #trigger><KButton size="sm">Connect AWS account</KButton></template>

        <ol class="m-0 mb-2 flex list-none gap-2 p-0 text-xs font-semibold text-fg-muted">
          <li
            v-for="(s, i) in ['Region', 'Create role', 'Check']"
            :key="s"
            :class="step === i + 1 && 'text-primary'"
          >
            {{ i + 1 }}. {{ s }}
          </li>
        </ol>

        <form v-if="step === 1" id="aws-step" class="flex flex-col gap-4" @submit.prevent="create">
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            SES region <KSelect v-model="region" :options="regions" />
          </label>
          <p class="text-sm text-fg-muted">
            Projects must send from the same region as their connection.
          </p>
        </form>

        <form
          v-else-if="step === 2 && created"
          id="aws-step"
          class="flex flex-col gap-4"
          @submit.prevent="verify"
        >
          <p class="text-sm">
            Launch the Dak stack in your account. It creates the sending role, SES configuration
            sets and the event topic. The external ID below is filled in for you; keep it private.
          </p>
          <KCopyField label="External ID" :value="created.externalId" />
          <KButton
            as="a"
            :href="created.launchUrl"
            target="_blank"
            rel="noopener"
            variant="secondary"
          >
            Open AWS CloudFormation <ExternalLink />
          </KButton>
          <KTextField
            v-model="roleArn"
            label="RoleArn (from the stack outputs)"
            mono
            required
            :status="wizardError ? 'error' : 'default'"
            :message="wizardError"
          />
        </form>

        <div v-else-if="step === 3 && verified" class="flex flex-col gap-4">
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="c in verified.health.checks" :key="c.id" class="flex gap-2 text-sm">
              <CircleCheck
                v-if="c.ok"
                :size="18"
                class="shrink-0 text-success"
                aria-hidden="true"
              />
              <CircleAlert v-else :size="18" class="shrink-0 text-danger" aria-hidden="true" />
              <span>
                <span class="font-semibold">{{ c.label }}</span>
                <span v-if="c.detail" class="block text-fg-muted">{{ c.detail }}</span>
              </span>
            </li>
          </ul>
          <template v-if="verified.health.ok">
            <label v-if="byoProjects.length" class="flex flex-col gap-1.5 text-sm font-semibold">
              Use for project
              <KSelect v-model="attachTo" :options="byoProjects" placeholder="Choose a project" />
            </label>
            <p v-else class="text-sm text-fg-muted">
              Create a project with “Your AWS account” to send through this connection.
            </p>
          </template>
        </div>

        <template #footer>
          <KButton variant="ghost" @click="open = false">{{
            step === 3 ? 'Close' : 'Cancel'
          }}</KButton>
          <KButton v-if="step === 1" type="submit" form="aws-step">Continue</KButton>
          <KButton v-else-if="step === 2" type="submit" form="aws-step" :loading="verifying"
            >Verify</KButton
          >
          <KButton v-else-if="verified?.health.ok && attachTo" @click="attach(verified!.id)">
            Use this connection
          </KButton>
          <KButton v-else-if="step === 3" variant="secondary" @click="step = 2">Try again</KButton>
        </template>
      </KDialog>
    </div>

    <KEmptyState
      v-if="connections.data.value?.length === 0"
      :icon="Cloud"
      title="No AWS accounts connected"
      description="Projects use Dak-managed AWS unless you connect your own account."
    />

    <article
      v-for="c in connections.data.value"
      :key="c.id"
      class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <header class="flex flex-wrap items-center gap-3">
        <KStatusPill
          :status="c.status"
          :tones="{ disconnecting: 'warning', disconnected: 'neutral' }"
        />
        <span class="font-semibold">{{ c.accountId ?? 'Account not verified' }}</span>
        <span class="text-sm text-fg-muted">{{ c.region }}</span>
        <span class="font-mono text-xs text-fg-muted">{{ c.id }}</span>
        <span class="flex-1" />
        <KButton
          v-if="c.roleArn && c.status !== 'disconnected'"
          size="sm"
          variant="outline"
          @click="recheck(c.id)"
        >
          Re-check
        </KButton>
        <KAlertDialog
          v-if="hasPermission('infrastructure', 'manage') && c.status !== 'disconnected'"
          title="Disconnect this AWS account?"
          description="Projects using it stop sending immediately. Mail already handed to SES cannot be recalled. Dak finishes accepted work, then stops using the role."
          confirm-label="Disconnect"
          @confirm="disconnect(c.id)"
        >
          <template #trigger><KButton size="sm" variant="ghost">Disconnect</KButton></template>
        </KAlertDialog>
      </header>
      <KAlert
        v-if="c.health && !c.health.ok"
        tone="warning"
        title="This connection needs attention"
        :dismissible="false"
      >
        <span v-for="ch in c.health.checks.filter((x) => !x.ok)" :key="ch.id" class="block">
          {{ ch.label }}<template v-if="ch.detail">: {{ ch.detail }}</template>
        </span>
      </KAlert>
    </article>
  </section>
</template>
