<script setup lang="ts">
import { KButton, KSelect, KTextarea, KTextField } from '@khata/ui'
import { newBlock, type Block, type BlockDocument, type BlockType } from '@khata/dak-core'
import {
  ArrowDown,
  ArrowUp,
  Columns2,
  Heading,
  Image,
  Minus,
  MousePointerClick,
  PanelBottom,
  Code,
  Space,
  Trash2,
  Type,
} from '@lucide/vue'
import { computed, ref } from 'vue'

/**
 * Block editor: a palette, the ordered block list and an inspector for the selected block,
 * plus brand presets. The document renders to email HTML with `renderBlocks` (shared with
 * the API, which re-renders authoritatively on save).
 */
const doc = defineModel<BlockDocument>({ required: true })
const selected = ref<number | null>(0)

const palette: { type: BlockType; label: string; icon: unknown }[] = [
  { type: 'header', label: 'Header', icon: Heading },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'button', label: 'Button', icon: MousePointerClick },
  { type: 'columns', label: 'Columns', icon: Columns2 },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: Space },
  { type: 'footer', label: 'Footer', icon: PanelBottom },
  { type: 'html', label: 'HTML', icon: Code },
]

function update(blocks: Block[]) {
  doc.value = { ...doc.value, blocks }
}
function add(type: BlockType) {
  const at = selected.value === null ? doc.value.blocks.length : selected.value + 1
  const blocks = [...doc.value.blocks]
  blocks.splice(at, 0, newBlock(type))
  update(blocks)
  selected.value = at
}
function move(i: number, by: -1 | 1) {
  const j = i + by
  if (j < 0 || j >= doc.value.blocks.length) return
  const blocks = [...doc.value.blocks]
  ;[blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!]
  update(blocks)
  selected.value = j
}
function remove(i: number) {
  update(doc.value.blocks.filter((_, k) => k !== i))
  selected.value = null
}
function patch(fields: Record<string, unknown>) {
  if (selected.value === null) return
  const blocks = [...doc.value.blocks]
  blocks[selected.value] = { ...blocks[selected.value]!, ...fields } as Block
  update(blocks)
}
function patchColumnText(col: number, idx: number, content: string) {
  const b = current.value
  if (b?.type !== 'columns' || !b.columns) return
  const columns = b.columns.map((c, ci) =>
    ci !== col
      ? c
      : {
          blocks: c.blocks.map((x, xi) =>
            xi === idx && x.type === 'text' ? { ...x, content } : x,
          ),
        },
  )
  patch({ columns })
}
function brand(fields: Record<string, unknown>) {
  doc.value = { ...doc.value, brand: { ...doc.value.brand, ...fields } }
}

/** Inspector view of the selected block; fields vary by type. */
interface LooseBlock {
  type: BlockType
  content?: string
  size?: string
  align?: string
  label?: string
  href?: string
  src?: string
  alt?: string
  title?: string
  height?: number
  columns?: { blocks: { type: string; content?: string }[] }[]
}
const current = computed(() =>
  selected.value === null
    ? undefined
    : (doc.value.blocks[selected.value] as LooseBlock | undefined),
)
const LINK_HINT = 'https://, mailto: or a variable such as {{ url }}'
const inspected = computed(() => (current.value ? [current.value] : []))

function summary(b: Block): string {
  switch (b.type) {
    case 'text':
    case 'footer':
    case 'html':
      return b.content.slice(0, 60)
    case 'button':
      return b.label
    case 'image':
      return b.alt || b.src
    case 'header':
      return b.title ?? 'Logo'
    case 'columns':
      return `${b.columns.length} columns`
    case 'spacer':
      return `${b.height}px`
    default:
      return ''
  }
}

const aligns = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
]
const sizes = [
  { value: 'small', label: 'Small' },
  { value: 'body', label: 'Body' },
  { value: 'large', label: 'Large' },
  { value: 'heading', label: 'Heading' },
]
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[160px_1fr]">
    <nav aria-label="Add block" class="flex flex-wrap gap-1.5 lg:flex-col">
      <KButton
        v-for="p in palette"
        :key="p.type"
        size="sm"
        variant="outline"
        class="justify-start"
        @click="add(p.type)"
      >
        <component :is="p.icon" aria-hidden="true" /> {{ p.label }}
      </KButton>
    </nav>

    <div class="flex min-w-0 flex-col gap-4">
      <ol class="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Blocks">
        <li
          v-for="(b, i) in doc.blocks"
          :key="i"
          class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          :class="selected === i ? 'border-primary bg-primary-subtle' : 'border-line bg-surface'"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 border-0 bg-transparent p-0 text-left"
            :aria-pressed="selected === i"
            @click="selected = i"
          >
            <span class="font-semibold capitalize">{{ b.type }}</span>
            <span class="truncate text-fg-muted">{{ summary(b) }}</span>
          </button>
          <KButton size="sm" variant="ghost" icon-only aria-label="Move up" @click="move(i, -1)"
            ><ArrowUp
          /></KButton>
          <KButton size="sm" variant="ghost" icon-only aria-label="Move down" @click="move(i, 1)"
            ><ArrowDown
          /></KButton>
          <KButton size="sm" variant="ghost" icon-only aria-label="Delete block" @click="remove(i)"
            ><Trash2
          /></KButton>
        </li>
      </ol>

      <section
        v-for="cur in inspected"
        :key="`${selected}-${cur.type}`"
        class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
        aria-label="Block settings"
      >
        <template v-if="cur.type === 'text' || cur.type === 'footer' || cur.type === 'html'">
          <KTextarea
            :model-value="cur.content ?? ''"
            :label="cur.type === 'html' ? 'HTML' : 'Text (Liquid allowed, e.g. {{ name }})'"
            :mono="cur.type === 'html'"
            :rows="cur.type === 'html' ? 8 : 4"
            @update:model-value="(v: string) => patch({ content: v })"
          />
          <div v-if="cur.type === 'text'" class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-sm font-semibold"
              >Size<KSelect
                :model-value="cur.size"
                :options="sizes"
                @update:model-value="(v) => patch({ size: v })"
            /></label>
            <label class="flex flex-col gap-1 text-sm font-semibold"
              >Align<KSelect
                :model-value="cur.align"
                :options="aligns"
                @update:model-value="(v) => patch({ align: v })"
            /></label>
          </div>
        </template>
        <template v-else-if="cur.type === 'button'">
          <KTextField
            :model-value="cur.label ?? ''"
            label="Label"
            @update:model-value="(v: string) => patch({ label: v })"
          />
          <KTextField
            :model-value="cur.href ?? ''"
            label="Link"
            mono
            :hint="LINK_HINT"
            @update:model-value="(v: string) => patch({ href: v })"
          />
          <label class="flex flex-col gap-1 text-sm font-semibold"
            >Align<KSelect
              :model-value="cur.align"
              :options="aligns"
              @update:model-value="(v) => patch({ align: v })"
          /></label>
        </template>
        <template v-else-if="cur.type === 'image'">
          <KTextField
            :model-value="cur.src ?? ''"
            label="Image URL"
            mono
            @update:model-value="(v: string) => patch({ src: v })"
          />
          <KTextField
            :model-value="cur.alt ?? ''"
            label="Alt text"
            hint="Describe the image for screen readers."
            @update:model-value="(v: string) => patch({ alt: v })"
          />
          <KTextField
            :model-value="cur.href ?? ''"
            label="Link (optional)"
            mono
            @update:model-value="(v: string) => patch({ href: v || undefined })"
          />
        </template>
        <template v-else-if="cur.type === 'header'">
          <KTextField
            :model-value="cur.title ?? ''"
            label="Title (optional)"
            @update:model-value="(v: string) => patch({ title: v || undefined })"
          />
        </template>
        <template v-else-if="cur.type === 'spacer'">
          <KTextField
            :model-value="String(cur.height)"
            label="Height (px)"
            type="number"
            @update:model-value="(v: string) => patch({ height: Number(v) || 24 })"
          />
        </template>
        <template v-else-if="cur.type === 'columns' && cur.columns">
          <div
            class="grid gap-3"
            :style="{ gridTemplateColumns: `repeat(${cur.columns.length}, minmax(0, 1fr))` }"
          >
            <div v-for="(col, ci) in cur.columns" :key="ci" class="flex flex-col gap-2">
              <template v-for="(leaf, li) in col.blocks" :key="li">
                <KTextarea
                  v-if="leaf.type === 'text'"
                  :model-value="leaf.content"
                  :label="`Column ${ci + 1}`"
                  :rows="3"
                  @update:model-value="(v: string) => patchColumnText(ci, li, v)"
                />
              </template>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-fg-muted">This block has no settings.</p>
      </section>

      <details class="rounded-lg border border-line bg-surface p-4">
        <summary class="cursor-pointer text-sm font-semibold">Brand</summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <KTextField
            :model-value="doc.brand.logoUrl ?? ''"
            label="Logo URL"
            mono
            @update:model-value="(v: string) => brand({ logoUrl: v || undefined })"
          />
          <KTextField
            :model-value="doc.brand.logoAlt"
            label="Logo alt text"
            @update:model-value="(v: string) => brand({ logoAlt: v })"
          />
          <label
            v-for="k in ['primaryColor', 'textColor', 'backgroundColor', 'contentColor'] as const"
            :key="k"
            class="flex items-center gap-3 text-sm font-semibold"
          >
            <input
              type="color"
              :value="doc.brand[k]"
              class="h-9 w-12 cursor-pointer rounded border border-line"
              @input="brand({ [k]: ($event.target as HTMLInputElement).value })"
            />
            {{ k.replace('Color', ' colour').replace(/^./, (c) => c.toUpperCase()) }}
          </label>
        </div>
      </details>
    </div>
  </div>
</template>
