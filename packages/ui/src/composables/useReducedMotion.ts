import { onBeforeUnmount, onMounted, ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Snapshot: does the viewer ask for reduced motion? */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches
}

/**
 * Reactive version of `prefersReducedMotion`. Starts `false` (what the server renders) and syncs
 * on mount, so server-rendered and hydrated markup agree.
 */
export function useReducedMotion() {
  const reduced = ref(false)
  let mql: MediaQueryList | undefined
  const update = (e: MediaQueryListEvent) => (reduced.value = e.matches)
  onMounted(() => {
    mql = window.matchMedia?.(QUERY)
    reduced.value = !!mql?.matches
    mql?.addEventListener('change', update)
  })
  onBeforeUnmount(() => mql?.removeEventListener('change', update))
  return reduced
}
