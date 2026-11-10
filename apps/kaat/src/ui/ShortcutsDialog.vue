<script setup lang="ts">
import { KDialog, KKbd } from '@khata/ui'
import { computed } from 'vue'

import { SHORTCUTS } from './shortcuts'
import { useEditor } from './useEditor'

const editor = useEditor()
const open = computed({
  get: () => editor.ui.shortcutsOpen,
  set: (v) => (editor.ui.shortcutsOpen = v),
})
</script>

<template>
  <KDialog v-model:open="open" title="Keyboard shortcuts" class="max-w-[560px]!">
    <dl
      class="m-0 grid max-h-[60vh] grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 overflow-y-auto text-sm"
    >
      <template v-for="s in SHORTCUTS" :key="s.keys">
        <dt>
          <KKbd>{{ s.keys }}</KKbd>
        </dt>
        <dd class="m-0 text-fg-muted">{{ s.action }}</dd>
      </template>
    </dl>
  </KDialog>
</template>
