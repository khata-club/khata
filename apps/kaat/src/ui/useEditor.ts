import { type InjectionKey, inject } from 'vue'

import type { Editor } from '../engine/editor'

export const EditorKey: InjectionKey<Editor> = Symbol('editor')

export function useEditor(): Editor {
  const e = inject(EditorKey)
  if (!e) throw new Error('useEditor() outside the editor')
  return e
}
