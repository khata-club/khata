<script setup lang="ts">
import { KButton, KSegmentedControl, KSplitter, KSplitterHandle, KSplitterPanel } from '@khata/ui'
import {
  CloudOff,
  Download,
  FolderKanban,
  Gauge,
  Keyboard,
  Redo2,
  ShieldCheck,
  Undo2,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import DiagnosticsPanel from './DiagnosticsPanel.vue'
import ExportDialog from './ExportDialog.vue'
import { itemsFromDrop } from './files'
import ClipInspector from './inspector/ClipInspector.vue'
import AudioPanel from './panels/AudioPanel.vue'
import EffectsPanel from './panels/EffectsPanel.vue'
import MediaPanel from './panels/MediaPanel.vue'
import TextPanel from './panels/TextPanel.vue'
import PreviewPanel from './PreviewPanel.vue'
import ProjectsDialog from './ProjectsDialog.vue'
import { installShortcuts } from './shortcuts'
import ShortcutsDialog from './ShortcutsDialog.vue'
import TimelinePanel from './timeline/TimelinePanel.vue'
import type { TimelineView } from './timeline/TimelineView'
import ToastStack from './ToastStack.vue'
import { useEditor } from './useEditor'

const editor = useEditor()
const timeline = ref<{ view: () => TimelineView | undefined }>()
const dropping = ref(false)
let dragDepth = 0
let uninstall: (() => void) | undefined

const tabs = [
  { value: 'media', label: 'Media' },
  { value: 'text', label: 'Text' },
  { value: 'effects', label: 'Effects' },
  { value: 'audio', label: 'Audio' },
]
const tab = computed({
  get: () => editor.ui.leftTab,
  set: (v) => (editor.ui.leftTab = v as typeof editor.ui.leftTab),
})

const saveText = computed(() => {
  switch (editor.ui.saveState) {
    case 'saving':
      return 'Saving…'
    case 'pending':
      return 'Unsaved changes'
    case 'error':
      return 'Save failed'
    default:
      return 'Saved on this device'
  }
})

// Files dragged in from the OS import anywhere in the editor.
function isFiles(e: DragEvent) {
  return [...(e.dataTransfer?.types ?? [])].includes('Files')
}
function onDragEnter(e: DragEvent) {
  if (!isFiles(e)) return
  dragDepth++
  dropping.value = true
}
function onDragLeave(e: DragEvent) {
  if (!isFiles(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dropping.value = false
}
function onDragOver(e: DragEvent) {
  if (isFiles(e)) e.preventDefault()
}
function onDrop(e: DragEvent) {
  if (!isFiles(e)) return
  e.preventDefault()
  dragDepth = 0
  dropping.value = false
  const items = itemsFromDrop(e)
  void items.then((list) => {
    const offline = Object.values(editor.store.project.assets).filter(
      (a) => editor.sources.state(a.id) !== 'ready',
    )
    // Dropping files that match offline media relinks them; the rest import.
    const relinkable = list.filter((i) => offline.some((a) => a.name === i.file.name))
    const rest = list.filter((i) => !relinkable.includes(i))
    if (relinkable.length) void editor.relinkMany(relinkable)
    if (rest.length) void editor.importFiles(rest)
  })
}

function zoom(f: number | 'fit') {
  const v = timeline.value?.view()
  if (!v) return
  if (f === 'fit') v.zoomToFit()
  else v.setZoom(v.pps * f)
}

function onPageHide() {
  // Both writes start synchronously: the page may be gone before an awaited chain finishes.
  void editor.autosave.flush()
  void editor.autosave.writeSession(editor.store.project.id, true)
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (editor.exporter.running) e.preventDefault()
  void editor.autosave.flush()
}

onMounted(() => {
  uninstall = installShortcuts(editor, zoom)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void editor.autosave.flush()
  })
})
onBeforeUnmount(() => {
  uninstall?.()
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div
    class="flex h-full flex-col"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <header class="flex h-12 flex-none items-center gap-2 border-b border-line bg-surface px-3">
      <span class="flex items-center gap-2 pr-2">
        <span
          class="grid size-7 place-items-center rounded-sm bg-primary text-sm font-black text-white"
          >K</span
        >
        <span class="text-base font-bold">Kaat</span>
      </span>
      <button
        class="k-icon-btn w-auto! gap-1.5 px-2 text-sm font-semibold text-fg!"
        aria-label="Projects"
        data-testid="projects"
        @click="editor.ui.projectsOpen = true"
      >
        <FolderKanban />
        <span class="max-w-[220px] truncate" data-testid="project-name">{{
          editor.project.value?.name
        }}</span>
      </button>
      <span
        class="text-[11px] text-fg-muted"
        :class="editor.ui.saveState === 'error' && 'font-semibold text-danger'"
        data-testid="save-state"
        >{{ saveText }}</span
      >
      <div class="mx-1 h-5 w-px bg-line" />
      <button
        class="k-icon-btn"
        :disabled="!editor.ui.undoLabel"
        :title="`Undo ${editor.ui.undoLabel ?? ''} (Ctrl+Z)`"
        aria-label="Undo"
        @click="editor.undo()"
      >
        <Undo2 />
      </button>
      <button
        class="k-icon-btn"
        :disabled="!editor.ui.redoLabel"
        :title="`Redo ${editor.ui.redoLabel ?? ''} (Ctrl+Shift+Z)`"
        aria-label="Redo"
        @click="editor.redo()"
      >
        <Redo2 />
      </button>
      <div class="flex-1" />
      <span
        class="hidden items-center gap-1.5 rounded-full border border-success-border bg-success-subtle px-2.5 py-1 text-[11px] font-semibold text-success md:flex"
        title="All processing happens in this browser. Media is never uploaded."
      >
        <ShieldCheck class="size-3.5" /> On-device only
      </span>
      <span
        v-if="!editor.ui.online"
        class="flex items-center gap-1 text-[11px] font-semibold text-fg-muted"
        title="Offline: editing, playback, autosave and export keep working."
      >
        <CloudOff class="size-3.5" /> Offline
      </span>
      <button
        class="k-icon-btn"
        aria-label="Keyboard shortcuts"
        title="Shortcuts (?)"
        @click="editor.ui.shortcutsOpen = true"
      >
        <Keyboard />
      </button>
      <button
        class="k-icon-btn"
        :aria-pressed="editor.ui.diagnostics"
        aria-label="Diagnostics"
        title="Diagnostics (Ctrl+Shift+D)"
        @click="editor.ui.diagnostics = !editor.ui.diagnostics"
      >
        <Gauge />
      </button>
      <KButton size="sm" class="h-8" data-testid="export" @click="editor.ui.exportOpen = true"
        ><Download />Export</KButton
      >
    </header>

    <main class="min-h-0 flex-1">
      <KSplitter direction="vertical" auto-save-id="kaat-v">
        <KSplitterPanel :default-size="60" :min-size="25">
          <KSplitter auto-save-id="kaat-h">
            <KSplitterPanel :default-size="22" :min-size="14" class="flex flex-col bg-surface">
              <div class="flex-none border-b border-line p-2">
                <KSegmentedControl
                  v-model="tab"
                  :options="tabs"
                  label="Library"
                  size="sm"
                  class="w-full"
                  data-testid="library-tabs"
                />
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto">
                <MediaPanel v-if="tab === 'media'" />
                <TextPanel v-else-if="tab === 'text'" />
                <EffectsPanel v-else-if="tab === 'effects'" />
                <AudioPanel v-else />
              </div>
            </KSplitterPanel>
            <KSplitterHandle />
            <KSplitterPanel :default-size="56" :min-size="30">
              <PreviewPanel />
            </KSplitterPanel>
            <KSplitterHandle />
            <KSplitterPanel :default-size="22" :min-size="14" class="bg-surface">
              <ClipInspector v-if="editor.ui.engineReady" />
            </KSplitterPanel>
          </KSplitter>
        </KSplitterPanel>
        <KSplitterHandle />
        <KSplitterPanel :default-size="40" :min-size="18">
          <TimelinePanel v-if="editor.ui.engineReady" ref="timeline" />
        </KSplitterPanel>
      </KSplitter>
    </main>

    <div
      v-if="dropping"
      class="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-primary/10 backdrop-blur-[1px]"
    >
      <div
        class="rounded-xl border-2 border-dashed border-primary bg-surface px-10 py-8 text-center shadow-floating"
      >
        <p class="m-0 text-lg font-bold">Drop to import</p>
        <p class="m-0 mt-1 text-sm text-fg-muted">
          Files stay on your device. Editing starts right away.
        </p>
      </div>
    </div>

    <ToastStack />
    <ExportDialog v-if="editor.ui.engineReady" />
    <ProjectsDialog />
    <ShortcutsDialog />
    <DiagnosticsPanel v-if="editor.ui.diagnostics && editor.ui.engineReady" />
  </div>
</template>
