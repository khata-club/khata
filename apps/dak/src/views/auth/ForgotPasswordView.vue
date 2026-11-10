<script setup lang="ts">
import { KButton, KTextField } from '@khata/ui'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient } from '@/lib/auth'

const email = ref('')
const sent = ref(false)

async function submit() {
  // Always report success so the form cannot be used to probe for accounts.
  await authClient.requestPasswordReset({
    email: email.value,
    redirectTo: `${window.location.origin}/reset-password`,
  })
  sent.value = true
}
</script>

<template>
  <AuthCard title="Reset your password">
    <p v-if="sent" class="text-sm">
      If an account exists for <strong>{{ email }}</strong
      >, a reset link is on its way.
    </p>
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <KTextField v-model="email" label="Email" type="email" autocomplete="email" required />
      <KButton type="submit">Send reset link</KButton>
    </form>
    <template #footer
      ><RouterLink to="/sign-in" class="text-primary">Back to sign in</RouterLink></template
    >
  </AuthCard>
</template>
