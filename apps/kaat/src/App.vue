<script setup lang="ts">
import { KSpinner } from '@khata/ui'
import { onMounted, provide, shallowRef } from 'vue'

import { type CapabilityReport, checkCapabilities } from './engine/capabilities'
import { Editor } from './engine/editor'
import { telemetry } from './engine/telemetry'
import EditorShell from './ui/EditorShell.vue'
import UnsupportedScreen from './ui/UnsupportedScreen.vue'
import { EditorKey } from './ui/useEditor'

const editor = new Editor()
provide(EditorKey, editor)
const caps = shallowRef<CapabilityReport>()

onMounted(async () => {
  caps.value = await checkCapabilities()
  editor.caps = caps.value
  // Handles for tests and the diagnostics workflow.
  Object.assign(window, { kaat: editor, kaatTelemetry: telemetry })
})
</script>

<template>
  <div v-if="!caps" class="grid h-full place-items-center text-fg-muted" aria-busy="true">
    <KSpinner />
  </div>
  <UnsupportedScreen v-else-if="!caps.ok" :report="caps" />
  <EditorShell v-else />
</template>
