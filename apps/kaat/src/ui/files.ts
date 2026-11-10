import type { ImportItem } from '../engine/editor'

const MEDIA_TYPES = [
  {
    description: 'Video, audio and images',
    accept: {
      'video/*': ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.ts', '.mts'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif'],
    },
  },
]

/**
 * Pick local files. Uses the File System Access picker when available, so Kaat can keep a handle
 * and reopen the file after a restart without a copy. Falls back to a plain file input.
 */
export async function pickFiles(multiple = true): Promise<ImportItem[]> {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({ multiple, types: MEDIA_TYPES })
      return Promise.all(handles.map(async (h) => ({ file: await h.getFile(), handle: h })))
    } catch (e) {
      if ((e as Error).name === 'AbortError') return []
      // Fall through to a plain input.
    }
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = multiple
  input.accept = 'video/*,audio/*,image/*,.mkv,.mov,.ts'
  return new Promise((resolve) => {
    input.addEventListener(
      'change',
      () => resolve([...(input.files ?? [])].map((file) => ({ file }))),
      { once: true },
    )
    input.addEventListener('cancel', () => resolve([]), { once: true })
    input.click()
  })
}

/** Files from an <input type=file> change event (no handles: session-only access). */
export function itemsFromInput(e: Event): ImportItem[] {
  const input = e.target as HTMLInputElement
  const items = [...(input.files ?? [])].map((file) => ({ file }))
  input.value = ''
  return items
}

/** Collect files (and handles where Chrome provides them) from a drop event. Must run synchronously. */
export function itemsFromDrop(e: DragEvent): Promise<ImportItem[]> {
  const dt = e.dataTransfer
  if (!dt) return Promise.resolve([])
  const entries = [...dt.items].filter((i) => i.kind === 'file')
  // getAsFileSystemHandle must be called during the event, before any await.
  const pending = entries.map((i) => ({ file: i.getAsFile(), handle: i.getAsFileSystemHandle?.() }))
  return Promise.all(
    pending.map(async (p) => {
      let handle: FileSystemFileHandle | undefined
      try {
        const h = await p.handle
        if (h && h.kind === 'file') handle = h as FileSystemFileHandle
      } catch {
        handle = undefined
      }
      return { file: p.file!, handle }
    }),
  ).then((items) => items.filter((i) => !!i.file))
}
