import { readonly, ref } from 'vue'

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface Toast {
  id: number
  title: string
  description?: string
  tone: ToastTone
  /** Milliseconds before auto-dismiss; 0 keeps it until closed. */
  duration: number
}

export type ToastInput = Omit<Toast, 'id' | 'tone' | 'duration'> &
  Partial<Pick<Toast, 'tone' | 'duration'>>

const toasts = ref<Toast[]>([])
let nextId = 1

/** App-wide toast queue rendered by a single `<KToaster />`. */
export function useToast() {
  function toast(input: ToastInput): number {
    const id = nextId++
    toasts.value = [...toasts.value, { tone: 'neutral', duration: 5000, ...input, id }]
    return id
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  function clear() {
    toasts.value = []
  }
  return { toasts: readonly(toasts), toast, dismiss, clear }
}
