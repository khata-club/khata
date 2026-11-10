<script setup lang="ts">
import { KButton, KTextField } from '@khata/ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthCard from '@/components/AuthCard.vue'
import { authClient, authErrorMessage } from '@/lib/auth'
import { loadMe } from '@/lib/session'

const router = useRouter()
const name = ref('')
const error = ref<string>()
const slug = computed(() =>
  name.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40),
)

onMounted(async () => {
  // Returning users: activate their first organization instead of creating another.
  const { data } = await authClient.organization.list()
  const first = data?.[0]
  if (first) {
    await authClient.organization.setActive({ organizationId: first.id })
    await loadMe(true)
    await router.replace('/')
  }
})

async function submit() {
  const { error: err } = await authClient.organization.create({
    name: name.value,
    slug: `${slug.value}-${Math.random().toString(36).slice(2, 6)}`,
  })
  if (err) return (error.value = authErrorMessage(err))
  await loadMe(true)
  await router.replace('/')
}
</script>

<template>
  <AuthCard
    title="Name your organization"
    subtitle="Organizations hold workspaces, projects, domains and billing."
    :error="error"
  >
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <KTextField v-model="name" label="Organization name" autocomplete="organization" required />
      <KButton type="submit" :disabled="!slug">Continue</KButton>
    </form>
  </AuthCard>
</template>
