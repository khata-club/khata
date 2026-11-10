import { onScopeDispose, ref } from 'vue'

/** Clipboard copy with a transient `copied` flag for feedback. */
export function useCopy(resetMs = 1600) {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), resetMs)
    return true
  }

  onScopeDispose(() => clearTimeout(timer))
  return { copied, copy }
}
