import type { Editor } from '../engine/editor'

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Play / pause' },
  { keys: 'J / K / L', action: 'Reverse / stop / forward shuttle (repeat to speed up)' },
  { keys: '← / →', action: 'Previous / next frame (Shift: 1 second)' },
  { keys: 'Home / End', action: 'Go to start / end' },
  { keys: 'S  or  Ctrl+K', action: 'Split at playhead (selected clips, or all tracks)' },
  { keys: 'Delete', action: 'Delete selection' },
  { keys: 'Shift+Delete', action: 'Ripple delete selection' },
  { keys: 'Ctrl+Z / Ctrl+Shift+Z', action: 'Undo / redo' },
  { keys: 'I / O', action: 'Set in / out point' },
  { keys: 'Alt+X', action: 'Clear in / out' },
  { keys: 'Ctrl+L', action: 'Toggle loop of in/out range' },
  { keys: 'M', action: 'Add marker' },
  { keys: 'T', action: 'Add text at playhead' },
  { keys: 'N', action: 'Toggle snapping' },
  { keys: '+ / − / \\', action: 'Zoom in / out / fit timeline' },
  { keys: 'Ctrl+A', action: 'Select all clips' },
  { keys: 'Ctrl+E', action: 'Export video' },
  { keys: 'Ctrl+S', action: 'Save now (autosave runs anyway)' },
  { keys: 'Ctrl+Shift+D', action: 'Performance diagnostics' },
  { keys: '?', action: 'Show shortcuts' },
]

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return (
    t.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) ||
    t.getAttribute('role') === 'slider'
  )
}

export function installShortcuts(
  editor: Editor,
  zoom: (factor: number | 'fit') => void,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (typing(e)) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key
    const tr = editor.transport
    const handled = (() => {
      if (mod && e.shiftKey && (k === 'd' || k === 'D'))
        return (void (editor.ui.diagnostics = !editor.ui.diagnostics), true)
      if (mod && (k === 'z' || k === 'Z')) return (e.shiftKey ? editor.redo() : editor.undo(), true)
      if (mod && (k === 'y' || k === 'Y')) return (editor.redo(), true)
      if (mod && (k === 'k' || k === 'K')) return (editor.splitAtPlayhead(), true)
      if (mod && (k === 'l' || k === 'L')) return (editor.toggleLoop(), true)
      if (mod && (k === 'e' || k === 'E')) return (void (editor.ui.exportOpen = true), true)
      if (mod && (k === 's' || k === 'S')) return (void editor.autosave.flush(), true)
      if (mod && (k === 'a' || k === 'A')) {
        editor.ui.selection = editor.seq.tracks
          .filter((t) => !t.locked)
          .flatMap((t) => t.clips.map((c) => c.id))
        return true
      }
      if (mod) return false
      if (e.altKey && (k === 'x' || k === 'X' || e.code === 'KeyX'))
        return (editor.clearInOut(), true)
      switch (k) {
        case ' ':
          tr.toggle()
          return true
        case 'j':
        case 'J':
          tr.shuttle('j')
          return true
        case 'k':
        case 'K':
          tr.shuttle('k')
          return true
        case 'l':
        case 'L':
          tr.shuttle('l')
          return true
        case 'ArrowLeft':
          tr.stepFrames(
            e.shiftKey
              ? -Math.round(
                  editor.store.project.settings.fps.num / editor.store.project.settings.fps.den,
                )
              : -1,
          )
          return true
        case 'ArrowRight':
          tr.stepFrames(
            e.shiftKey
              ? Math.round(
                  editor.store.project.settings.fps.num / editor.store.project.settings.fps.den,
                )
              : 1,
          )
          return true
        case 'Home':
          tr.seek(0)
          return true
        case 'End':
          tr.seek(editor.duration())
          return true
        case 's':
        case 'S':
          editor.splitAtPlayhead()
          return true
        case 'Delete':
        case 'Backspace':
          editor.deleteSelection(e.shiftKey)
          return true
        case 'i':
        case 'I':
          editor.setIn()
          return true
        case 'o':
        case 'O':
          editor.setOut()
          return true
        case 'm':
        case 'M':
          editor.addMarker()
          return true
        case 't':
        case 'T':
          editor.addText()
          return true
        case 'n':
        case 'N':
          editor.ui.snapping = !editor.ui.snapping
          return true
        case '=':
        case '+':
          zoom(1.5)
          return true
        case '-':
        case '_':
          zoom(1 / 1.5)
          return true
        case '\\':
          zoom('fit')
          return true
        case '?':
          editor.ui.shortcutsOpen = !editor.ui.shortcutsOpen
          return true
        case 'Escape':
          editor.ui.selection = []
          return true
      }
      return false
    })()
    if (handled) e.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
