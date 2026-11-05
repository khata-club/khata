<script setup lang="ts">
import { KButton } from '@khata/ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient, authErrorMessage } from '@/lib/auth'
import { loadMe } from '@/lib/session'

const props = defineProps<{ id: string }>()
const router = useRouter()
const error = ref<string>()

async function respond(accept: boolean) {
  const { error: err } = accept
    ? await authClient.organization.acceptInvitation({ invitationId: props.id })
    : await authClient.organization.rejectInvitation({ invitationId: props.id })
  if (err) return (error.value = authErrorMessage(err))
  await loadMe(true)
  await router.replace('/')
}
</script>

<template>
  <AuthCard
    title="Join an organization"
    subtitle="You were invited to a Dak organization."
    :error="error"
  >
    <div class="flex gap-3">
      <KButton class="flex-1" @click="respond(true)">Accept</KButton>
      <KButton class="flex-1" variant="outline" @click="respond(false)">Decline</KButton>
    </div>
  </AuthCard>
</template>
