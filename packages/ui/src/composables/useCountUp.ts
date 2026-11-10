import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { prefersReducedMotion } from './useReducedMotion'

/**
 * Animate a number toward `target` with an ease-out-cubic curve. Respects reduced motion and the
 * kit's `--motion-scale` (0 snaps instantly). Safe to call during server rendering.
 */
export function useCountUp(
  target: MaybeRefOrGetter<number>,
  {
    duration = 600,
    from,
  }: {
    /** Milliseconds; may be a getter so speed changes apply to the next run. */
    duration?: MaybeRefOrGetter<number>
    from?: number
  } = {},
) {
  const current = ref(from ?? toValue(target))
  const canAnimate = () => typeof window !== 'undefined' && 'requestAnimationFrame' in window
  let frame = 0

  const motionScale = () => {
    const v = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--motion-scale'),
    )
    return Number.isNaN(v) ? 1 : v
  }

  function cancel() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  function run(to: number) {
    if (!canAnimate()) {
      current.value = to
      return
    }
    cancel()
    const start = current.value
    const ms = prefersReducedMotion() ? 0 : toValue(duration) * motionScale()
    if (ms <= 0 || start === to) {
      current.value = to
      return
    }
    const t0 = performance.now()
    const step = (t: number) => {
      const progress = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - progress, 3)
      current.value = start + (to - start) * eased
      frame = progress < 1 ? requestAnimationFrame(step) : 0
    }
    frame = requestAnimationFrame(step)
  }

  watch(() => toValue(target), run, { immediate: from !== undefined })
  onBeforeUnmount(cancel)

  return current
}
