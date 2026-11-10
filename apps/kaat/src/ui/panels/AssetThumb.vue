<script setup lang="ts">
import type { Asset } from '@khata/kaat-core'
import { AudioLines, Film, Image as ImageIcon } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useEditor } from '../useEditor'

const { asset } = defineProps<{ asset: Asset }>()
const editor = useEditor()
const canvas = ref<HTMLCanvasElement>()
const has = ref(false)
let off: (() => void) | undefined

function draw() {
  if (asset.kind === 'audio' || asset.status !== 'ready') return
  const file = editor.sources.get(asset.id)
  const durSec = asset.duration / 705_600_000
  const bmp = editor.media.thumb(asset.id, file, durSec, asset.kind === 'image' ? 0 : 6, 0)
  editor.media.flushThumbs()
  const c = canvas.value
  if (!bmp || !c) return
  const ctx = c.getContext('2d')!
  const k = Math.max(c.width / bmp.width, c.height / bmp.height)
  ctx.drawImage(
    bmp,
    (c.width - bmp.width * k) / 2,
    (c.height - bmp.height * k) / 2,
    bmp.width * k,
    bmp.height * k,
  )
  has.value = true
}

onMounted(() => {
  off = editor.media.on('thumb', ({ assetId }) => {
    if (assetId === asset.id && !has.value) draw()
  })
  draw()
})
watch(
  () => asset.status,
  () => draw(),
)
onBeforeUnmount(() => off?.())
</script>

<template>
  <div
    class="relative grid h-10 w-16 flex-none place-items-center overflow-hidden rounded-[6px] bg-gray-900 text-gray-400"
  >
    <canvas v-show="has" ref="canvas" width="128" height="80" class="absolute inset-0 size-full" />
    <template v-if="!has">
      <AudioLines v-if="asset.kind === 'audio'" class="size-4 text-success" />
      <ImageIcon v-else-if="asset.kind === 'image'" class="size-4" />
      <Film v-else class="size-4" />
    </template>
  </div>
</template>
