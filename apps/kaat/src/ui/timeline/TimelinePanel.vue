<script setup lang="ts">
import { type Track, type TrackPatch } from '@khata/kaat-core'
import { KSlider } from '@khata/ui'
import {
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Magnet,
  Maximize2,
  Plus,
  Scissors,
  Trash2,
  Volume2,
  VolumeX,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { ASSET_MIME, draggedAsset } from '../dnd'
import { useEditor } from '../useEditor'
import { RULER_H, type Row, TimelineView } from './TimelineView'

const editor = useEditor()
const host = ref<HTMLDivElement>()
const base = ref<HTMLCanvasElement>()
const overlay = ref<HTMLCanvasElement>()
const rows = shallowRef<Row[]>([])
const scrollY = ref(0)
let view: TimelineView | undefined
let ro: ResizeObserver | undefined

// Zoom slider works in log space so both ends are usable.
const zoom = computed({
  get: () => Math.log(editor.ui.pxPerSecond),
  set: (v: number) => view?.setZoom(Math.exp(v)),
})

onMounted(() => {
  view = new TimelineView(editor, base.value!, overlay.value!)
  view.onRows = (r, sy) => {
    // Only touch Vue state when the row layout actually changed.
    const prev = rows.value
    if (prev.length !== r.length || prev.some((p, i) => p.track !== r[i]!.track || p.y !== r[i]!.y))
      rows.value = r
    scrollY.value = sy
  }
  ;(window as unknown as { kaatTimeline: TimelineView }).kaatTimeline = view
  ro = new ResizeObserver(([e]) => {
    if (!e) return
    view!.resize(e.contentRect.width, e.contentRect.height)
  })
  ro.observe(host.value!)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  view?.destroy()
})

watch(
  () => [editor.ui.selection, editor.ui.snapping] as const,
  () => view?.invalidate(),
)

function trackPatch(t: Track, patch: TrackPatch) {
  editor.exec({ type: 'updateTrack', trackId: t.id, patch })
}

// ── drag & drop from the media panel ─────────────────────────────────────────────────────────
function assetFromEvent(e: DragEvent) {
  const id = e.dataTransfer?.getData(ASSET_MIME) || draggedAsset()
  return id ? editor.store.project.assets[id] : undefined
}
function onDragOver(e: DragEvent) {
  const types = e.dataTransfer?.types ?? []
  if (!types.includes(ASSET_MIME)) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
  const id = draggedAsset()
  const a = id ? editor.store.project.assets[id] : undefined
  if (!a || !view) return
  view.dropAt(
    e.clientX,
    e.clientY,
    editor.defaultDuration(a),
    a.kind === 'audio' ? 'audio' : 'video',
  )
}
function onDragLeave() {
  view?.clearDrop()
}
function onDrop(e: DragEvent) {
  const a = assetFromEvent(e)
  const hint = view?.dropHint
  view?.clearDrop()
  if (!a || !hint) return
  e.preventDefault()
  e.stopPropagation()
  editor.placeAsset(a.id, hint.t, hint.row?.track.id)
}

function headerStyle(r: Row) {
  return { top: `${r.y}px`, height: `${r.h}px` }
}

const fmtZoom = computed(() => {
  const pps = editor.ui.pxPerSecond
  return pps >= 1 ? `${Math.round(pps)} px/s` : `${(1 / pps).toFixed(0)} s/px`
})

defineExpose({ view: () => view })
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-surface" aria-label="Timeline">
    <div class="flex h-9 flex-none items-center gap-1 border-b border-line px-2">
      <button
        class="k-icon-btn"
        title="Split at playhead (S)"
        aria-label="Split at playhead"
        @click="editor.splitAtPlayhead()"
      >
        <Scissors />
      </button>
      <button
        class="k-icon-btn"
        title="Ripple delete (Shift+Delete)"
        aria-label="Ripple delete"
        :disabled="!editor.ui.selection.length"
        @click="editor.deleteSelection(true)"
      >
        <Trash2 />
      </button>
      <div class="mx-1 h-5 w-px bg-line" />
      <button
        class="k-icon-btn"
        :aria-pressed="editor.ui.snapping"
        title="Snapping (N)"
        aria-label="Snapping"
        @click="editor.ui.snapping = !editor.ui.snapping"
      >
        <Magnet />
      </button>
      <button
        class="k-icon-btn"
        title="Add video track"
        aria-label="Add video track"
        @click="editor.exec({ type: 'addTrack', kind: 'video' })"
      >
        <Plus /><span class="sr-only">Video track</span>
      </button>
      <span class="text-[11px] text-fg-muted">V</span>
      <button
        class="k-icon-btn"
        title="Add audio track"
        aria-label="Add audio track"
        @click="editor.exec({ type: 'addTrack', kind: 'audio' })"
      >
        <Plus />
      </button>
      <span class="text-[11px] text-fg-muted">A</span>
      <div class="flex-1" />
      <span class="w-16 text-right font-mono text-[10px] text-fg-muted">{{ fmtZoom }}</span>
      <KSlider
        v-model="zoom"
        :min="Math.log(0.01)"
        :max="Math.log(3000)"
        :step="0.01"
        label="Timeline zoom"
        class="w-36"
      />
      <button
        class="k-icon-btn"
        title="Zoom to fit (\)"
        aria-label="Zoom to fit"
        @click="view?.zoomToFit()"
      >
        <Maximize2 />
      </button>
    </div>
    <div class="flex min-h-0 flex-1">
      <!-- Track headers (DOM), aligned with canvas rows. -->
      <div
        class="relative w-[150px] flex-none overflow-hidden border-r border-line bg-surface-subtle"
      >
        <div
          class="absolute inset-x-0 top-0 z-10 flex items-center border-b border-line bg-surface-subtle px-2"
          :style="{ height: `${RULER_H}px` }"
        >
          <span class="k-panel-title">Tracks</span>
        </div>
        <div
          v-for="r in rows"
          :key="r.track.id"
          class="absolute inset-x-0 flex items-center gap-0.5 border-b border-line px-1.5"
          :style="headerStyle(r)"
          :data-track="r.track.name"
        >
          <span
            class="w-7 flex-none text-xs font-bold"
            :class="r.track.kind === 'video' ? 'text-primary' : 'text-success'"
            >{{ r.track.name }}</span
          >
          <template v-if="r.track.kind === 'video'">
            <button
              class="k-icon-btn"
              :aria-pressed="r.track.hidden"
              :aria-label="`${r.track.hidden ? 'Show' : 'Hide'} ${r.track.name}`"
              :title="r.track.hidden ? 'Show track' : 'Hide track'"
              @click="trackPatch(r.track, { hidden: !r.track.hidden })"
            >
              <EyeOff v-if="r.track.hidden" />
              <Eye v-else />
            </button>
          </template>
          <template v-else>
            <button
              class="k-icon-btn"
              :aria-pressed="r.track.muted"
              :aria-label="`Mute ${r.track.name}`"
              title="Mute"
              @click="trackPatch(r.track, { muted: !r.track.muted })"
            >
              <VolumeX v-if="r.track.muted" />
              <Volume2 v-else />
            </button>
            <button
              class="k-icon-btn font-bold"
              :aria-pressed="r.track.solo"
              :aria-label="`Solo ${r.track.name}`"
              title="Solo"
              @click="trackPatch(r.track, { solo: !r.track.solo })"
            >
              S
            </button>
          </template>
          <button
            class="k-icon-btn"
            :aria-pressed="r.track.locked"
            :aria-label="`${r.track.locked ? 'Unlock' : 'Lock'} ${r.track.name}`"
            title="Lock"
            @click="trackPatch(r.track, { locked: !r.track.locked })"
          >
            <Lock v-if="r.track.locked" />
            <LockOpen v-else />
          </button>
          <button
            class="k-icon-btn ml-auto opacity-60 hover:opacity-100"
            :aria-label="`Remove ${r.track.name}`"
            title="Remove track"
            @click="editor.exec({ type: 'removeTrack', trackId: r.track.id })"
          >
            <Trash2 />
          </button>
        </div>
      </div>
      <div
        ref="host"
        class="relative min-w-0 flex-1 overflow-hidden"
        data-testid="timeline-canvas"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <canvas ref="base" class="absolute inset-0" aria-hidden="true" />
        <canvas
          ref="overlay"
          class="absolute inset-0 touch-none"
          aria-label="Timeline tracks. Drag clips to move, edges to trim."
        />
      </div>
    </div>
  </section>
</template>
