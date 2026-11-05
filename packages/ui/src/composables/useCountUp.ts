import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { prefersReducedMotion } from './useReducedMotion'

/**
 * Animate a number toward `target` with an ease-out-cubic curve. Respects reduced motion and the
 * kit's `--motion-scale` (0 snaps instantly).
 */
export function useCountUp(
  target: MaybeRefOrGetter<number>,
  { duration = 600, from }: { duration?: number; from?: number } = {},
) {
  const current = ref(from ?? toValue(target))
  let raf = 0

  const motionScale = () => {
    if (typeof window === 'undefined') return 1
    const v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--motion-scale'),
    )
    return Number.isNaN(v) ? 1 : v
  }

  function run(to: number) {
    cancelAnimationFrame(raf)
    const start = current.value
    const dur = prefersReducedMotion() ? 0 : duration * motionScale()
    if (dur <= 0 || start === to || typeof requestAnimationFrame === 'undefined') {
      current.value = to
      return
    }
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      current.value = start + (to - start) * e
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }

  watch(() => toValue(target), run, { immediate: from !== undefined })
  onBeforeUnmount(() => cancelAnimationFrame(raf))

  return current
}
