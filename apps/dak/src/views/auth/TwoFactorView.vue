<script setup lang="ts">
import { KButton, KCheckbox, KTextField } from '@khata/ui'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient, authErrorMessage } from '@/lib/auth'
import { loadMe } from '@/lib/session'

const route = useRoute()
const router = useRouter()
const code = ref('')
const trust = ref(false)
const backup = ref(false)
const error = ref<string>()

async function submit() {
  error.value = undefined
  const { error: err } = backup.value
    ? await authClient.twoFactor.verifyBackupCode({ code: code.value, trustDevice: trust.value })
    : await authClient.twoFactor.verifyTotp({ code: code.value, trustDevice: trust.value })
  if (err) return (error.value = authErrorMessage(err))
  await loadMe(true)
  await router.replace(String(route.query.redirect ?? '/'))
}
</script>

<template>
  <AuthCard
    title="Two-step verification"
    :subtitle="
      backup ? 'Enter one of your backup codes.' : 'Enter the code from your authenticator app.'
    "
    :error="error"
  >
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <KTextField
        v-model="code"
        :label="backup ? 'Backup code' : '6-digit code'"
        autocomplete="one-time-code"
        :inputmode="backup ? 'text' : 'numeric'"
        mono
        required
      />
      <label class="flex items-center gap-2 text-sm">
        <KCheckbox v-model="trust" /> Trust this device for 30 days
      </label>
      <KButton type="submit">Verify</KButton>
      <KButton variant="ghost" type="button" @click="backup = !backup">
        {{ backup ? 'Use authenticator code' : 'Use a backup code' }}
      </KButton>
    </form>
  </AuthCard>
</template>
