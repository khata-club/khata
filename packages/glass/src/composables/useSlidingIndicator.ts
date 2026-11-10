import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  type ComponentPublicInstance,
  type CSSProperties,
  type Ref,
} from 'vue'

type Target = HTMLElement | ComponentPublicInstance | null | undefined

/**
 * Tracks the active item inside `root` (first match of `activeSelector`) and returns a style that
 * places an absolutely positioned indicator over it — the sliding glass capsule of segmented
 * controls, tabs and the tab bar. `root` must be the indicator's containing block.
 *
 * The first placement is instant; later moves transition. `moving` is true while the capsule
 * travels, so components can let it swell slightly like Liquid Glass does under a finger.
 */
export function useSlidingIndicator(root: Ref<Target>, activeSelector: string) {
  const rect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
  const settled = ref(false)
  const moving = ref(false)
  let ro: ResizeObserver | undefined
  let mo: MutationObserver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const node = (): HTMLElement | null => {
    const v = root.value
    if (!v) return null
    return v instanceof HTMLElement ? v : (v.$el as HTMLElement)
  }

  function measure() {
    const el = node()
    const active = el?.querySelector<HTMLElement>(activeSelector)
    if (!el || !active) {
      rect.value = null
      return
    }
    const next = {
      x: active.offsetLeft,
      y: active.offsetTop,
      w: active.offsetWidth,
      h: active.offsetHeight,
    }
    const prev = rect.value
    if (prev && settled.value && (prev.x !== next.x || prev.w !== next.w)) {
      moving.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (moving.value = false), 220)
    }
    rect.value = next
  }

  onMounted(() => {
    const el = node()
    if (!el) return
    measure()
    requestAnimationFrame(() => requestAnimationFrame(() => (settled.value = true)))
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(el)
      for (const child of Array.from(el.children)) ro.observe(child)
    }
    mo = new MutationObserver(measure)
    mo.observe(el, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'aria-selected', 'aria-current', 'data-active'],
    })
  })
  onBeforeUnmount(() => {
    ro?.disconnect()
    mo?.disconnect()
    clearTimeout(timer)
  })

  const style = computed<CSSProperties>(() => {
    const r = rect.value
    if (!r) return { opacity: 0, width: 0 }
    return {
      width: `${r.w}px`,
      height: `${r.h}px`,
      transform: `translate(${r.x}px, ${r.y}px)`,
      ...(settled.value ? {} : { transition: 'none' }),
    }
  })

  return { style, moving, visible: computed(() => rect.value != null), measure }
}
