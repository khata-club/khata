<script setup lang="ts">
import { KButton, KTextField } from '@khata/ui'
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient, authErrorMessage } from '@/lib/auth'

const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref<string>()
const busy = ref(false)
const sent = ref(false)

async function submit() {
  busy.value = true
  error.value = undefined
  const { data, error: err } = await authClient.signUp.email({
    name: name.value,
    email: email.value,
    password: password.value,
  })
  busy.value = false
  if (err) return (error.value = authErrorMessage(err))
  if (data?.token) return router.replace('/onboarding')
  sent.value = true
}
</script>

<template>
  <AuthCard
    title="Create your account"
    :subtitle="sent ? undefined : 'Start with a sandbox environment; no card needed.'"
    :error="error"
  >
    <p v-if="sent" class="text-sm">
      We sent a verification link to <strong>{{ email }}</strong
      >. Open it to finish signing up.
    </p>
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <KTextField v-model="name" label="Your name" autocomplete="name" required />
      <KTextField v-model="email" label="Work email" type="email" autocomplete="email" required />
      <KTextField
        v-model="password"
        label="Password"
        type="password"
        autocomplete="new-password"
        hint="At least 12 characters."
        minlength="12"
        required
      />
      <KButton type="submit" :disabled="busy">{{ busy ? 'Creating…' : 'Create account' }}</KButton>
    </form>
    <template #footer>
      Already have an account? <RouterLink to="/sign-in" class="text-primary">Sign in</RouterLink>
    </template>
  </AuthCard>
</template>
