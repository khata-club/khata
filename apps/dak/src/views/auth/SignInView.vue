<script setup lang="ts">
import { KButton, KDivider, KTextField } from '@khata/ui'
import { KeyRound } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient, authErrorMessage } from '@/lib/auth'
import { loadMe } from '@/lib/session'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref<string>()
const busy = ref(false)

async function done() {
  await loadMe(true)
  await router.replace(String(route.query.redirect ?? '/'))
}

async function submit() {
  busy.value = true
  error.value = undefined
  const { data, error: err } = await authClient.signIn.email({
    email: email.value,
    password: password.value,
  })
  busy.value = false
  if (err) return (error.value = authErrorMessage(err))
  if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
    return router.push({ name: 'two-factor', query: route.query })
  }
  await done()
}

async function withPasskey() {
  error.value = undefined
  const result = await authClient.signIn.passkey()
  if (result?.error) return (error.value = authErrorMessage(result.error))
  await done()
}
</script>

<template>
  <AuthCard title="Sign in" subtitle="Send, design and troubleshoot every email." :error="error">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <KTextField
        v-model="email"
        label="Email"
        type="email"
        autocomplete="username webauthn"
        required
      />
      <KTextField
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
      />
      <div class="flex justify-end text-sm">
        <RouterLink to="/forgot-password" class="text-primary">Forgot password?</RouterLink>
      </div>
      <KButton type="submit" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</KButton>
    </form>
    <KDivider />
    <KButton variant="outline" @click="withPasskey"><KeyRound /> Sign in with a passkey</KButton>
    <template #footer>
      New to Dak? <RouterLink to="/sign-up" class="text-primary">Create an account</RouterLink>
    </template>
  </AuthCard>
</template>
