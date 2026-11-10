import { computed, useAttrs } from 'vue'

const ARIA_NAMING = ['aria-label', 'aria-labelledby', 'aria-describedby'] as const

/**
 * For components whose root is a wrapper around the real control (input, slider thumb): split
 * fallthrough attributes so `aria-label` / `aria-labelledby` / `aria-describedby` land on the
 * control, and everything else (data-*, style…) stays on the root.
 * Use with `defineOptions({ inheritAttrs: false })`.
 */
export function useControlAttrs() {
  const attrs = useAttrs()
  const isNaming = (key: string) => (ARIA_NAMING as readonly string[]).includes(key)
  return {
    root: computed(() => Object.fromEntries(Object.entries(attrs).filter(([k]) => !isNaming(k)))),
    control: computed(() => Object.fromEntries(Object.entries(attrs).filter(([k]) => isNaming(k)))),
  }
}
