<script setup lang="ts">
import { html } from '@codemirror/lang-html'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const { label, language = 'html' } = defineProps<{ label: string; language?: 'html' | 'text' }>()
const model = defineModel<string>({ required: true })
const host = ref<HTMLDivElement>()
let view: EditorView | undefined

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        basicSetup,
        ...(language === 'html' ? [html()] : []),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': label }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) model.value = u.state.doc.toString()
        }),
        EditorView.theme({
          '&': { fontSize: '13px', height: '100%' },
          '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
        }),
      ],
    }),
  })
})

watch(model, (v) => {
  if (view && v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" class="min-h-80 overflow-hidden rounded-lg border border-line bg-surface" />
</template>
