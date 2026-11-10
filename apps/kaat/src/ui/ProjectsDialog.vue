<script setup lang="ts">
import { KButton, KDialog } from '@khata/ui'
import { FileUp, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import {
  type ProjectIndexRow,
  deleteProject,
  listProjects,
  loadProject,
} from '../engine/persist/autosave'
import { useEditor } from './useEditor'

const editor = useEditor()
const open = computed({
  get: () => editor.ui.projectsOpen,
  set: (v) => (editor.ui.projectsOpen = v),
})
const rows = ref<ProjectIndexRow[]>([])
const fileInput = ref<HTMLInputElement>()

watch(open, async (v) => {
  if (v) rows.value = await listProjects()
})

async function openRow(r: ProjectIndexRow) {
  await editor.autosave.flush()
  const loaded = await loadProject(r.id)
  if (loaded) await editor.open(loaded.project)
  open.value = false
}
async function remove(r: ProjectIndexRow) {
  if (r.id === editor.store.project.id) return
  await deleteProject(r.id)
  rows.value = await listProjects()
}
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) void editor.importProjectFile(f).then(() => (open.value = false))
}
const when = (t: number) => new Date(t).toLocaleString()
</script>

<template>
  <KDialog
    v-model:open="open"
    title="Projects"
    description="Saved in this browser on this device."
    class="max-w-[560px]!"
  >
    <ul class="m-0 flex max-h-[50vh] list-none flex-col gap-1 overflow-y-auto p-0">
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex items-center gap-3 rounded-md border border-line p-2.5"
      >
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate text-sm font-semibold">
            {{ r.name }}
            <span v-if="r.id === editor.store.project.id" class="text-xs font-normal text-primary"
              >· open</span
            >
          </p>
          <p class="m-0 text-[11px] text-fg-muted">
            {{ r.clips }} clips · saved {{ when(r.savedAt) }}
          </p>
        </div>
        <KButton
          size="sm"
          variant="secondary"
          class="h-8"
          :disabled="r.id === editor.store.project.id"
          @click="openRow(r)"
          >Open</KButton
        >
        <button
          class="k-icon-btn"
          :disabled="r.id === editor.store.project.id"
          :aria-label="`Delete ${r.name}`"
          @click="remove(r)"
        >
          <Trash2 />
        </button>
      </li>
      <li v-if="!rows.length" class="text-sm text-fg-muted">No saved projects yet.</li>
    </ul>
    <input
      ref="fileInput"
      type="file"
      accept=".json,.kaat.json,application/json"
      class="hidden"
      data-testid="project-file-input"
      @change="onFile"
    />
    <template #footer>
      <KButton size="sm" variant="neutral" @click="fileInput?.click()"
        ><FileUp />Import project file</KButton
      >
      <KButton size="sm" variant="neutral" @click="editor.exportProjectFile()"
        >Export project file</KButton
      >
      <KButton size="sm" @click="(editor.newProject(), (open = false))">New project</KButton>
    </template>
  </KDialog>
</template>
