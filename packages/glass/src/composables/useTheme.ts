import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'khata-glass-theme'
const QUERY = '(prefers-color-scheme: dark)'

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Light / dark / system preference for the whole page. Sets `data-theme` on `<html>` (removed
 * for "system") and remembers the choice in localStorage when it is available.
 */
export function useTheme() {
  const preference = ref<ThemePreference>(typeof window === 'undefined' ? 'system' : read())
  const systemDark = ref(false)
  let mql: MediaQueryList | undefined
  const onChange = (e: MediaQueryListEvent) => (systemDark.value = e.matches)

  onMounted(() => {
    mql = window.matchMedia?.(QUERY)
    systemDark.value = !!mql?.matches
    mql?.addEventListener('change', onChange)
  })
  onBeforeUnmount(() => mql?.removeEventListener('change', onChange))

  watch(
    preference,
    (p) => {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (p === 'system') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', p)
      try {
        if (p === 'system') localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, p)
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
    },
    { immediate: true },
  )

  const isDark = computed(() =>
    preference.value === 'system' ? systemDark.value : preference.value === 'dark',
  )
  return { preference, isDark }
}
