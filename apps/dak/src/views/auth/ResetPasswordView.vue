<script setup lang="ts">
import { KButton, KTextField } from '@khata/ui'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient, authErrorMessage } from '@/lib/auth'

const route = useRoute()
const router = useRouter()
const password = ref('')
const error = ref<string>()

async function submit() {
  const { error: err } = await authClient.resetPassword({
    newPassword: password.value,
    token: String(route.query.token ?? ''),
  })
  if (err) return (error.value = authErrorMessage(err))
  await router.replace('/sign-in')
}
</script>

<template>
  <AuthCard title="Choose a new password" :error="error">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <KTextField
        v-model="password"
        label="New password"
        type="password"
        autocomplete="new-password"
        hint="At least 12 characters."
        minlength="12"
        required
      />
      <KButton type="submit">Save password</KButton>
    </form>
  </AuthCard>
</template>
