<script setup lang="ts">
import { type Asset, formatDuration } from '@khata/kaat-core'
import { KButton, KProgress, KSpinner } from '@khata/ui'
import { CirclePlus, FolderOpen, Gauge, Link2, ShieldCheck, Trash2, Upload } from '@lucide/vue'
import { computed } from 'vue'

import { endAssetDrag, startAssetDrag } from '../dnd'
import { itemsFromInput, pickFiles } from '../files'
import { useEditor } from '../useEditor'
import AssetThumb from './AssetThumb.vue'

const editor = useEditor()

const assets = computed<Asset[]>(() => Object.values(editor.project.value?.assets ?? {}))

async function importClick() {
  const items = await pickFiles()
  if (items.length) await editor.importFiles(items)
}

async function relinkOne(a: Asset) {
  const [item] = await pickFiles(false)
  if (item) await editor.relink(a.id, item)
}

async function relinkAll() {
  await relinkFrom(await pickFiles(true))
}

async function relinkFrom(items: ReturnType<typeof itemsFromInput>) {
  if (!items.length) return
  const n = await editor.relinkMany(items)
  if (!n)
    editor.toast({
      title: 'No matches',
      body: 'None of the chosen files match an offline clip by name.',
      severity: 'warning',
    })
}

function offline(a: Asset) {
  return a.status !== 'probing' && a.status !== 'error' && editor.sources.state(a.id) !== 'ready'
}

function meta(a: Asset): string {
  if (a.status === 'probing') return 'Reading…'
  if (a.status === 'error') return a.error ?? 'Unreadable'
  const parts: string[] = []
  if (a.kind !== 'image') parts.push(formatDuration(a.duration))
  if (a.width) parts.push(`${a.width}×${a.height}`)
  if (a.fps) parts.push(`${Math.round((a.fps.num / a.fps.den) * 100) / 100} fps`)
  if (a.kind === 'audio' && a.sampleRate) parts.push(`${a.sampleRate / 1000} kHz`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex flex-none items-center gap-2 p-3">
      <KButton size="sm" class="flex-1" data-testid="import" @click="importClick"
        ><Upload />Import media</KButton
      >
      <!-- Plain inputs: used where the File System Access picker is unavailable, and by tests. -->
      <input
        type="file"
        class="hidden"
        data-testid="file-input"
        multiple
        @change="(e) => editor.importFiles(itemsFromInput(e))"
      />
      <input
        type="file"
        class="hidden"
        data-testid="relink-input"
        multiple
        @change="(e) => relinkFrom(itemsFromInput(e))"
      />
    </div>
    <div
      v-if="editor.ui.permissionCount"
      class="mx-3 mb-2 flex items-center gap-2 rounded-md border border-primary-soft bg-primary-subtle p-2 text-xs"
    >
      <span class="flex-1">{{ editor.ui.permissionCount }} file(s) need permission.</span>
      <KButton size="sm" variant="secondary" class="h-7 px-3" @click="editor.reconnectMedia()"
        >Reconnect</KButton
      >
    </div>
    <div
      v-if="editor.ui.missingCount"
      class="mx-3 mb-2 flex items-center gap-2 rounded-md border border-danger-border bg-danger-subtle p-2 text-xs text-danger"
      role="status"
    >
      <span class="flex-1">{{ editor.ui.missingCount }} file(s) offline. Edits are kept.</span>
      <KButton
        size="sm"
        variant="secondary"
        class="h-7 px-3"
        data-testid="relink-all"
        @click="relinkAll"
        ><Link2 />Relink</KButton
      >
    </div>
    <div
      v-if="!assets.length"
      class="m-3 grid flex-1 place-items-center rounded-lg border-2 border-dashed border-line p-6 text-center text-sm text-fg-muted"
    >
      <div class="flex flex-col items-center gap-2">
        <FolderOpen class="size-8 text-gray-400" />
        <p class="m-0 font-semibold text-fg">Drop video, audio or images</p>
        <p class="m-0 text-xs">Files are read on this device and never uploaded.</p>
      </div>
    </div>
    <ul
      v-else
      class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-2 pt-0"
      data-testid="media-list"
    >
      <li
        v-for="a in assets"
        :key="a.id"
        :data-asset="a.name"
        :data-status="offline(a) ? 'offline' : a.status"
        class="group flex items-center gap-2 rounded-md p-1.5 hover:bg-surface-recessed"
        :draggable="a.status === 'ready' && !offline(a)"
        @dragstart="startAssetDrag($event, a.id)"
        @dragend="endAssetDrag()"
        @dblclick="a.status === 'ready' && editor.appendAsset(a.id)"
      >
        <AssetThumb :asset="a" />
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate text-xs font-semibold" :title="a.name">{{ a.name }}</p>
          <p
            class="m-0 truncate text-[11px] text-fg-muted"
            :class="a.status === 'error' && 'text-danger'"
          >
            {{ meta(a) }}
          </p>
          <div v-if="a.proxy?.status === 'building'" class="mt-1">
            <KProgress
              :value="Math.round((a.proxy.progress ?? 0) * 100)"
              :show-value="false"
              label="Building proxy"
              class="h-1"
            />
          </div>
        </div>
        <KSpinner v-if="a.status === 'probing'" class="size-4" />
        <span v-else-if="offline(a)" class="flex items-center">
          <button
            class="k-icon-btn text-danger"
            :aria-label="`Relink ${a.name}`"
            title="Relink"
            @click="relinkOne(a)"
          >
            <Link2 />
          </button>
        </span>
        <template v-else-if="a.status === 'ready'">
          <button
            v-if="a.proxy?.status === 'recommended' || a.proxy?.status === 'error'"
            class="k-icon-btn text-warning"
            :aria-label="`Build proxy for ${a.name}`"
            title="Heavy media: build an editing proxy for smoother preview"
            @click="editor.buildProxy(a.id)"
          >
            <Gauge />
          </button>
          <button
            v-else-if="a.proxy?.status === 'building'"
            class="k-icon-btn"
            :aria-label="`Cancel proxy for ${a.name}`"
            title="Cancel proxy"
            @click="editor.cancelProxy(a.id)"
          >
            <KSpinner class="size-3.5" />
          </button>
          <span
            v-else-if="a.proxy?.status === 'ready'"
            class="text-success"
            title="Proxy in use for preview; export uses the original"
          >
            <ShieldCheck class="size-4" />
          </span>
          <button
            class="k-icon-btn opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            :aria-label="`Add ${a.name} to timeline`"
            title="Append to timeline"
            @click="editor.appendAsset(a.id)"
          >
            <CirclePlus />
          </button>
        </template>
        <button
          class="k-icon-btn opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          :aria-label="`Remove ${a.name}`"
          title="Remove from project (the file on disk is not touched)"
          @click="editor.removeAsset(a.id)"
        >
          <Trash2 />
        </button>
      </li>
    </ul>
  </div>
</template>
