import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Becomes `true` the first time `el` is at least `threshold` visible, then stops observing.
 * Falls back to `true` where IntersectionObserver is unavailable. Call `reset()` to watch again.
 */
export function useInView(el: Ref<Element | null | undefined>, { threshold = 0.15 } = {}) {
  const inView = ref(false)
  let io: IntersectionObserver | undefined

  function observe() {
    io?.disconnect()
    if (!el.value) return
    if (typeof IntersectionObserver === 'undefined') {
      inView.value = true
      return
    }
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          inView.value = true
          io?.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el.value)
  }

  function reset() {
    inView.value = false
    // Let the "hidden" state paint before observing again so transitions replay.
    requestAnimationFrame(() => requestAnimationFrame(observe))
  }

  onMounted(observe)
  onBeforeUnmount(() => io?.disconnect())

  return { inView, reset }
}
