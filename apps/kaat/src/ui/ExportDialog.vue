<script setup lang="ts">
import { activeSequence, formatDuration, sequenceDuration } from '@khata/kaat-core'
import {
  KButton,
  KDialog,
  KNumberField,
  KProgress,
  KSegmentedControl,
  KSelect,
  KSwitch,
} from '@khata/ui'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import type { ExportOptions, ExportState } from '../engine/export/exportService'
import { estimateBitrate, outputFps, outputSize } from '../engine/export/exportService'
import { useEditor } from './useEditor'

const editor = useEditor()
const open = computed({
  get: () => editor.ui.exportOpen,
  set: (v: boolean) => {
    if (!v && editor.exporter.running) return
    editor.ui.exportOpen = v
    if (!v) editor.exporter.reset()
  },
})
const state = ref<ExportState>(editor.exporter.state)
const off = editor.exporter.on('state', (s) => (state.value = s))
onBeforeUnmount(off)

const formats = editor.exporter.formats()
const o = reactive<ExportOptions>({
  resolution: 'project',
  fps: 'project',
  quality: 'high',
  bitrateMbps: 12,
  audioKbps: 192,
  format: formats.mp4 ? 'mp4' : 'webm',
  range: 'all',
  download:
    !window.showSaveFilePicker || new URLSearchParams(location.search).has('downloadExports'),
  fileName: editor.store.project.name,
})

const p = computed(() => editor.project.value!)
const size = computed(() => outputSize(p.value, o.resolution))
const fps = computed(() => outputFps(p.value, o.fps))
const bitrate = computed(() => estimateBitrate(o, size.value.width, size.value.height, fps.value))
const seq = computed(() => activeSequence(p.value))
const hasInOut = computed(() => seq.value.inPoint !== undefined || seq.value.outPoint !== undefined)
const duration = computed(() => {
  const end = sequenceDuration(seq.value)
  if (o.range === 'inout' && hasInOut.value)
    return (seq.value.outPoint ?? end) - (seq.value.inPoint ?? 0)
  return end
})
const estSize = computed(() => {
  const sec = duration.value / 705_600_000
  return ((bitrate.value + o.audioKbps * 1000) * sec) / 8 / 1048576
})
const resOptions = computed(() => [
  {
    value: 'project',
    label: `Match project (${p.value.settings.width}×${p.value.settings.height})`,
  },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p' },
  { value: '2160', label: '2160p (4K)' },
])
const fpsOptions = computed(() => [
  {
    value: 'project',
    label: `Match project (${Math.round((p.value.settings.fps.num / p.value.settings.fps.den) * 100) / 100})`,
  },
  ...['24', '25', '30', '50', '60'].map((v) => ({ value: v, label: `${v} fps` })),
])

function start() {
  // Called straight from the click: the save picker needs the user gesture.
  void editor.startExport({ ...o })
}
const fmtEta = (s: number) => (s > 0 ? formatDuration(s * 705_600_000) : '—')
</script>

<template>
  <KDialog
    v-model:open="open"
    title="Export video"
    description="Rendered on this device, frame by frame. Nothing is uploaded."
    class="max-w-[520px]!"
  >
    <div v-if="state.kind === 'running'" class="flex flex-col gap-3" data-testid="export-progress">
      <KProgress :value="Math.round(state.progress * 100)" label="Exporting" />
      <p class="m-0 text-xs text-fg-muted">
        {{ state.fps.toFixed(1) }} frames/s · about {{ fmtEta(state.eta) }} left. You can keep
        editing; changes made now won’t be in this export.
      </p>
    </div>
    <div
      v-else-if="state.kind === 'done'"
      class="rounded-md border border-success-border bg-success-subtle p-3 text-sm"
      role="status"
      data-testid="export-done"
    >
      Saved <strong>{{ state.fileName }}</strong> in {{ state.seconds.toFixed(1) }} s.
    </div>
    <div
      v-else-if="state.kind === 'cancelled'"
      class="rounded-md border border-line bg-surface-recessed p-3 text-sm"
      role="status"
    >
      Export cancelled. The partial file was discarded; your project is unchanged.
    </div>
    <div
      v-else-if="state.kind === 'error'"
      class="rounded-md border border-danger-border bg-danger-subtle p-3 text-sm text-danger"
      role="alert"
    >
      {{ state.error.message }}
    </div>

    <div v-if="state.kind !== 'running'" class="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
      <label class="k-field-label col-span-2" for="exp-name">File name</label>
      <input
        id="exp-name"
        v-model="o.fileName"
        class="col-span-2 h-9 rounded-sm border border-line px-2 outline-none focus:border-primary"
      />
      <span class="k-field-label">Format</span>
      <span class="k-field-label">Range</span>
      <KSegmentedControl
        v-model="o.format"
        label="Format"
        size="sm"
        :options="[
          { value: 'mp4', label: 'MP4 · H.264', disabled: !formats.mp4 },
          { value: 'webm', label: 'WebM · VP9', disabled: !formats.webm },
        ]"
      />
      <KSegmentedControl
        v-model="o.range"
        label="Range"
        size="sm"
        :options="[
          { value: 'all', label: 'Whole' },
          { value: 'inout', label: 'In → Out', disabled: !hasInOut },
        ]"
      />
      <span class="k-field-label">Resolution</span>
      <span class="k-field-label">Frame rate</span>
      <KSelect
        v-model="o.resolution"
        :options="resOptions"
        aria-label="Resolution"
        class="h-9! rounded-sm! px-2! text-xs!"
      />
      <KSelect
        v-model="o.fps"
        :options="fpsOptions"
        aria-label="Frame rate"
        class="h-9! rounded-sm! px-2! text-xs!"
      />
      <span class="k-field-label">Quality</span>
      <span class="k-field-label">Audio</span>
      <KSelect
        v-model="o.quality"
        aria-label="Quality"
        class="h-9! rounded-sm! px-2! text-xs!"
        :options="[
          { value: 'low', label: 'Low (small file)' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'manual', label: 'Manual bitrate' },
        ]"
      />
      <KSelect
        :model-value="String(o.audioKbps)"
        aria-label="Audio bitrate"
        class="h-9! rounded-sm! px-2! text-xs!"
        :options="['96', '128', '192', '256', '320'].map((v) => ({ value: v, label: `${v} kbps` }))"
        @update:model-value="(v) => (o.audioKbps = Number(v))"
      />
      <KNumberField
        v-if="o.quality === 'manual'"
        v-model="o.bitrateMbps"
        label="Video"
        suffix="Mbps"
        :min="0.5"
        :max="200"
        :step="0.5"
        :precision="1"
        class="col-span-2"
      />
      <label class="col-span-2 flex items-center gap-2 text-xs text-fg-muted">
        <KSwitch v-model="o.download" class="min-h-0! scale-75" aria-label="Save to Downloads" />
        Save to Downloads instead of choosing a location
      </label>
      <p class="col-span-2 m-0 font-mono text-[11px] text-fg-muted">
        {{ size.width }}×{{ size.height }} · {{ (fps.num / fps.den).toFixed(2) }} fps ·
        {{ (bitrate / 1e6).toFixed(1) }} Mbps · {{ formatDuration(duration) }} · ≈
        {{ estSize.toFixed(0) }} MB
      </p>
    </div>

    <template #footer>
      <KButton
        v-if="state.kind === 'running'"
        variant="danger"
        size="sm"
        data-testid="export-cancel"
        @click="editor.exporter.cancel()"
        >Cancel export</KButton
      >
      <template v-else>
        <KButton variant="neutral" size="sm" @click="open = false">Close</KButton>
        <KButton size="sm" data-testid="export-start" :disabled="duration <= 0" @click="start"
          >Export</KButton
        >
      </template>
    </template>
  </KDialog>
</template>
