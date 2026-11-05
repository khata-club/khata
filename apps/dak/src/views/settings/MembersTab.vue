<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { KButton, KDataTable, KDialog, KSelect, KTextField, useToast } from '@khata/ui'
import { ref } from 'vue'

import { authClient } from '@/lib/auth'
import { hasPermission, me } from '@/lib/session'

const ROLES = ['owner', 'admin', 'developer', 'marketer', 'analyst', 'billing'].map((r) => ({
  value: r,
  label: r[0]!.toUpperCase() + r.slice(1),
}))

const qc = useQueryClient()
const { toast } = useToast()
const members = useQuery({
  queryKey: ['members'],
  queryFn: async () => {
    const { data, error } = await authClient.organization.listMembers()
    if (error) throw error
    return data.members.map((m) => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      userId: m.userId,
    }))
  },
})

const open = ref(false)
const email = ref('')
const role = ref('developer')

async function invite() {
  const { error } = await authClient.organization.inviteMember({
    email: email.value,
    role: role.value as never,
  })
  if (error)
    return toast({ title: 'Invitation failed', description: error.message, tone: 'danger' })
  open.value = false
  toast({ title: `Invited ${email.value}`, tone: 'success' })
  email.value = ''
}

async function changeRole(memberId: string, value: string) {
  const { error } = await authClient.organization.updateMemberRole({
    memberId,
    role: value as 'developer',
  })
  if (error) toast({ title: 'Could not change role', description: error.message, tone: 'danger' })
  await qc.invalidateQueries({ queryKey: ['members'] })
}

async function remove(memberIdOrEmail: string) {
  const { error } = await authClient.organization.removeMember({ memberIdOrEmail })
  if (error) toast({ title: 'Could not remove member', description: error.message, tone: 'danger' })
  await qc.invalidateQueries({ queryKey: ['members'] })
}

const columns = [
  { key: 'name' as const, label: 'Name' },
  { key: 'email' as const, label: 'Email', class: 'max-md:hidden' },
  { key: 'role' as const, label: 'Role', class: 'w-44' },
  { key: 'id' as const, label: '', class: 'w-24', align: 'right' as const },
]
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-fg-muted">
        Roles follow least privilege. Reading email bodies is a separate, owner-only permission.
      </p>
      <KDialog
        v-if="hasPermission('invitation', 'create')"
        v-model:open="open"
        title="Invite a member"
      >
        <template #trigger><KButton size="sm">Invite</KButton></template>
        <form id="invite" class="flex flex-col gap-4" @submit.prevent="invite">
          <KTextField v-model="email" label="Email" type="email" required />
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            Role <KSelect v-model="role" :options="ROLES" />
          </label>
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">Cancel</KButton>
          <KButton type="submit" form="invite">Send invitation</KButton>
        </template>
      </KDialog>
    </div>
    <KDataTable
      :columns="columns"
      :rows="members.data.value ?? []"
      row-key="id"
      caption="Organization members"
      :loading="members.isPending.value"
    >
      <template #cell-role="{ row }">
        <KSelect
          v-if="hasPermission('member', 'update') && row.userId !== me?.user.id"
          :model-value="row.role"
          :options="ROLES"
          @update:model-value="(v) => v && changeRole(row.id, v)"
        />
        <span v-else class="capitalize">{{ row.role }}</span>
      </template>
      <template #cell-id="{ row }">
        <KButton
          v-if="hasPermission('member', 'delete') && row.userId !== me?.user.id"
          size="sm"
          variant="ghost"
          @click="remove(row.id)"
        >
          Remove
        </KButton>
      </template>
    </KDataTable>
  </section>
</template>
