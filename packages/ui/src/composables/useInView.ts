import { onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export interface InViewOptions {
  /** Fraction of the element that must be visible (default 0.15). */
  threshold?: number
  /** Return `true` to skip observing and count as in view at once (e.g. under reduced motion). */
  skip?: () => boolean
}

/**
 * Becomes `true` the first time `el` is at least `threshold` visible, then stops observing.
 * Falls back to `true` where IntersectionObserver is unavailable. Re-observes if the element is
 * swapped (e.g. by `v-if`). Call `reset()` to hide and watch again.
 */
export function useInView(
  el: MaybeRefOrGetter<Element | null | undefined>,
  { threshold = 0.15, skip = () => false }: InViewOptions = {},
) {
  const inView = ref(false)
  let io: IntersectionObserver | undefined
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function stop() {
    io?.disconnect()
    io = undefined
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    clearTimeout(timer)
  }

  function observe() {
    stop()
    const target = toValue(el)
    if (!target || inView.value) return
    if (typeof IntersectionObserver === 'undefined' || skip()) {
      inView.value = true
      return
    }
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          inView.value = true
          stop()
        }
      },
      { threshold },
    )
    io.observe(target)
  }

  /**
   * Hide, then observe again: after `delay` ms, or by default after two frames so the hidden state
   * paints first and entrance transitions replay.
   */
  function reset({ delay }: { delay?: number } = {}) {
    stop()
    inView.value = false
    if (delay !== undefined) timer = setTimeout(observe, delay)
    else frame = requestAnimationFrame(() => (frame = requestAnimationFrame(observe)))
  }

  onMounted(() => {
    observe()
    watch(() => toValue(el), observe)
  })
  onBeforeUnmount(stop)

  return { inView, reset }
}
