<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  KAlert,
  KBadge,
  KButton,
  KDialog,
  KStatusPill,
  KTabs,
  KTextarea,
  KTextField,
  useToast,
} from '@khata/ui'
import {
  checkTemplate,
  renderBlocks,
  TemplateVariables,
  type BlockDocument,
  type TemplateCheck,
} from '@khata/dak-core'
import { CircleAlert, TriangleAlert } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import CodeEditor from '@/components/CodeEditor.vue'
import VisualEditor from '@/components/VisualEditor.vue'
import EmailPreview from '@/components/EmailPreview.vue'
import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'
import { hasPermission } from '@/lib/session'

interface Version {
  id: string
  version: number
  status: 'draft' | 'published' | 'archived'
  subject: string
  html: string
  text: string | null
  variables: unknown[]
  blocks: BlockDocument | null
  publishedAt: number | null
}
interface Template {
  id: string
  alias: string
  name: string
  editor: 'code' | 'visual'
  publishedVersionId: string | null
  versions: Version[]
}

const props = defineProps<{ id: string }>()
const qc = useQueryClient()
const { toast } = useToast()
const { project, environment } = useCurrent()
const base = computed(() => `/api/projects/${project.value?.id}/templates/${props.id}`)

const tpl = useQuery({
  queryKey: ['template', () => props.id],
  enabled: computed(() => !!project.value),
  queryFn: () => http.get<Template>(base.value),
})

// Working copy: the draft if there is one, else the latest version.
const subject = ref('')
/** Visual document; null when editing HTML directly. */
const blocks = ref<BlockDocument | null>(null)
const html = ref('')
const text = ref('')
const variablesJson = ref('[]')
watch(
  () => tpl.data.value,
  (t) => {
    const v = t?.versions.find((x) => x.status === 'draft') ?? t?.versions[0]
    if (!v) return
    subject.value = v.subject
    html.value = v.html
    text.value = v.text ?? ''
    variablesJson.value = JSON.stringify(v.variables, null, 2)
    blocks.value = t?.editor === 'visual' ? v.blocks : null
  },
  { immediate: true },
)

const variables = computed(() => {
  try {
    return { ok: true as const, value: TemplateVariables.parse(JSON.parse(variablesJson.value)) }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message.split('\n')[0] : 'Invalid JSON',
    }
  }
})
const source = computed(() => ({
  subject: subject.value,
  html: blocks.value ? renderBlocks(blocks.value) : html.value,
  blocks: blocks.value,
  text: text.value || null,
  variables: variables.value.ok ? variables.value.value : [],
}))
const checks = computed<TemplateCheck[]>(() =>
  variables.value.ok ? checkTemplate(source.value, source.value.variables) : [],
)
const errors = computed(() => checks.value.filter((c) => c.level === 'error'))

// Server-rendered preview (same engine as sending), debounced.
const preview = ref<{ subject: string; html: string; text: string }>()
const previewError = ref<string>()
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  source,
  (s) => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      if (!project.value || !variables.value.ok) return
      try {
        preview.value = await http.post(`${base.value}/preview`, { source: s })
        previewError.value = undefined
      } catch (e) {
        previewError.value = e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Preview failed'
      }
    }, 350)
  },
  { deep: true, immediate: true },
)

const draft = computed(() => tpl.data.value?.versions.find((v) => v.status === 'draft'))
const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await http.put(`${base.value}/draft`, source.value)
    await qc.invalidateQueries({ queryKey: ['template'] })
    toast({ title: 'Draft saved', tone: 'success' })
  } finally {
    saving.value = false
  }
}
async function publish() {
  try {
    await http.put(`${base.value}/draft`, source.value)
    const r = await http.post<{ version: number }>(`${base.value}/publish`)
    await qc.invalidateQueries({ queryKey: ['template'] })
    await qc.invalidateQueries({ queryKey: ['templates'] })
    toast({ title: `Version ${r.version} is live`, tone: 'success' })
  } catch (e) {
    toast({
      title: 'Not published',
      description: e instanceof ApiError ? e.code : undefined,
      tone: 'danger',
    })
  }
}
async function rollback(versionId: string) {
  await http.post(`${base.value}/rollback`, { versionId })
  await qc.invalidateQueries({ queryKey: ['template'] })
}

const testOpen = ref(false)
const testTo = ref('')
const testFrom = ref('')
async function sendTest() {
  try {
    await http.put(`${base.value}/draft`, source.value)
    await http.post(`${base.value}/test`, {
      to: testTo.value,
      from: testFrom.value,
      environmentId: environment.value?.id,
    })
    testOpen.value = false
    toast({
      title: 'Test sent',
      description:
        environment.value?.kind === 'sandbox' ? 'Delivered to the sandbox sink.' : undefined,
      tone: 'success',
    })
  } catch (e) {
    toast({
      title: 'Test failed',
      description: e instanceof ApiError ? e.code.replace(/_/g, ' ') : undefined,
      tone: 'danger',
    })
  }
}

/** One-way: visual → HTML keeps the rendering but drops the blocks (spec §6). */
const convertOpen = ref(false)
function convertToCode() {
  html.value = renderBlocks(blocks.value!)
  blocks.value = null
  convertOpen.value = false
}

const tabs = computed(() => [
  { value: 'html', label: blocks.value ? 'Design' : 'HTML' },
  { value: 'text', label: 'Plain text' },
  { value: 'variables', label: 'Variables' },
])
const sendSnippet = computed(
  () => `{ "template": { "id": "${tpl.data.value?.alias}", "variables": { … } } }`,
)
</script>

<template>
  <section v-if="tpl.data.value" class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-bold">{{ tpl.data.value.name }}</h2>
      <span class="font-mono text-sm text-fg-muted">{{ tpl.data.value.alias }}</span>
      <KBadge v-if="draft" tone="warning" :dot="false">Draft v{{ draft.version }}</KBadge>
      <span class="flex-1" />
      <KDialog v-model:open="testOpen" title="Send a test">
        <template #trigger><KButton size="sm" variant="outline">Send test</KButton></template>
        <form id="test-send" class="flex flex-col gap-4" @submit.prevent="sendTest">
          <KTextField v-model="testFrom" label="From" placeholder="test@yourdomain.com" required />
          <KTextField v-model="testTo" label="To" type="email" required />
          <p class="text-sm text-fg-muted">
            Uses sample data and the <strong>{{ environment?.name }}</strong> environment.
          </p>
        </form>
        <template #footer>
          <KButton variant="ghost" @click="testOpen = false">Cancel</KButton>
          <KButton type="submit" form="test-send">Send</KButton>
        </template>
      </KDialog>
      <KButton
        v-if="hasPermission('template', 'write')"
        size="sm"
        variant="secondary"
        :loading="saving"
        @click="save"
      >
        Save draft
      </KButton>
      <KButton
        v-if="hasPermission('template', 'publish')"
        size="sm"
        :disabled="errors.length > 0 || !variables.ok"
        @click="publish"
      >
        Publish
      </KButton>
    </header>

    <div class="grid gap-6 xl:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-4">
        <KTextField v-model="subject" label="Subject" />
        <KTabs :items="tabs" label="Template content">
          <template #html>
            <div v-if="blocks" class="flex flex-col gap-3">
              <VisualEditor v-model="blocks" />
              <KDialog v-model:open="convertOpen" title="Switch to the HTML editor?">
                <template #trigger
                  ><KButton size="sm" variant="ghost">Edit as HTML…</KButton></template
                >
                <p class="text-sm">
                  The current design becomes HTML you can edit freely. HTML cannot be turned back
                  into visual blocks, so visual editing ends for this template.
                </p>
                <template #footer>
                  <KButton variant="ghost" @click="convertOpen = false">Keep visual</KButton>
                  <KButton @click="convertToCode">Switch to HTML</KButton>
                </template>
              </KDialog>
            </div>
            <CodeEditor v-else v-model="html" label="HTML source" />
          </template>
          <template #text>
            <KTextarea
              v-model="text"
              label="Plain text"
              hint="Leave empty to generate it from the HTML."
              :rows="14"
            />
          </template>
          <template #variables>
            <KTextarea
              v-model="variablesJson"
              label="Variables (JSON)"
              mono
              :rows="14"
              :status="variables.ok ? 'default' : 'error'"
              :message="
                variables.ok ? 'name, type, required, default, example, sensitive' : variables.error
              "
            />
          </template>
        </KTabs>
        <ul
          v-if="checks.length"
          class="m-0 flex list-none flex-col gap-1.5 p-0"
          aria-label="Checks"
        >
          <li v-for="c in checks" :key="c.id" class="flex gap-2 text-sm">
            <CircleAlert
              v-if="c.level === 'error'"
              :size="16"
              class="mt-0.5 shrink-0 text-danger"
              aria-hidden="true"
            />
            <TriangleAlert
              v-else
              :size="16"
              class="mt-0.5 shrink-0 text-warning"
              aria-hidden="true"
            />
            {{ c.message }}
          </li>
        </ul>
      </div>

      <div class="flex min-w-0 flex-col gap-3">
        <KAlert v-if="previewError" tone="warning" :title="previewError" :dismissible="false" />
        <p v-if="preview" class="text-sm">
          <span class="text-fg-muted">Subject:</span> {{ preview.subject }}
        </p>
        <EmailPreview :html="preview?.html ?? ''" />
        <p class="font-mono text-xs text-fg-muted">{{ sendSnippet }}</p>
      </div>
    </div>

    <section class="flex flex-col gap-2">
      <h3 class="text-lg font-semibold">Versions</h3>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li
          v-for="v in tpl.data.value.versions"
          :key="v.id"
          class="flex flex-wrap items-center gap-3 text-sm"
        >
          <span class="w-10 font-mono">v{{ v.version }}</span>
          <KStatusPill
            :status="v.id === tpl.data.value.publishedVersionId ? 'live' : v.status"
            :tones="{ live: 'success', published: 'neutral' }"
          />
          <span class="text-fg-muted">{{
            v.publishedAt ? new Date(v.publishedAt).toLocaleString() : ''
          }}</span>
          <KButton
            v-if="
              v.status === 'published' &&
              v.id !== tpl.data.value.publishedVersionId &&
              hasPermission('template', 'publish')
            "
            size="sm"
            variant="ghost"
            @click="rollback(v.id)"
          >
            Make live
          </KButton>
        </li>
      </ul>
    </section>
  </section>
</template>
