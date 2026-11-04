import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'

import { prefersReducedMotion, useReducedMotion } from '../composables/useReducedMotion'
import { PALETTES, type ChartPalette } from './lib/palette'

export interface ChartSettings {
  /** Calm (multi-hue) or Monochrome (blues). */
  palette?: ChartPalette
  /** Animation speed multiplier: 2 = twice as fast. */
  animationSpeed?: number
  /** Show horizontal grid lines. */
  showGrid?: boolean
}

interface ChartContext {
  settings: ComputedRef<Required<ChartSettings>>
  /** Incremented by `replay()`; charts watch it to re-run their entrance animations. */
  replayToken: Ref<number>
}

const KEY: InjectionKey<ChartContext> = Symbol('k-charts')

/** Called by KChartProvider. */
export function provideCharts(settings: ComputedRef<ChartSettings>) {
  const replayToken = ref(0)
  const ctx: ChartContext = {
    settings: computed(() => ({
      palette: settings.value.palette ?? 'Calm',
      animationSpeed: settings.value.animationSpeed ?? 1,
      showGrid: settings.value.showGrid ?? true,
    })),
    replayToken,
  }
  provide(KEY, ctx)
  return { replay: () => replayToken.value++ }
}

/**
 * Resolved theme for one chart: palette colours, the `--k` duration multiplier (tiny under reduced
 * motion), and grid opacity. Per-chart props override the provider.
 */
export function useChartTheme(overrides: () => ChartSettings) {
  const ctx = inject(KEY, null)
  const reduced = useReducedMotion()
  return computed(() => {
    const o = overrides()
    const palette = o.palette ?? ctx?.settings.value.palette ?? 'Calm'
    const speed = o.animationSpeed ?? ctx?.settings.value.animationSpeed ?? 1
    const showGrid = o.showGrid ?? ctx?.settings.value.showGrid ?? true
    const p = PALETTES[palette]
    return {
      mono: palette === 'Monochrome',
      P: p.series,
      INK: p.ink,
      k: reduced.value ? 0.001 : Math.round((1 / Math.max(0.25, speed)) * 1000) / 1000,
      gridOp: showGrid ? 1 : 0,
    }
  })
}

/**
 * Entrance state for a chart card: `revealed` flips to true once the card is 15% visible, and
 * resets (then re-observes) on `replay()` or when the provider replays everything.
 */
export function useChartReveal(
  el: Ref<HTMLElement | { $el: Element } | undefined>,
  /** Current duration multiplier (`theme.k`): replay waits for the exit transition. */
  k: () => number = () => 1,
) {
  const ctx = inject(KEY, null)
  const revealed = ref(false)
  let io: IntersectionObserver | undefined

  const node = () => {
    const v = el.value
    return v && '$el' in v ? v.$el : v
  }

  function observe() {
    io?.disconnect()
    const target = node()
    if (!target) return
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      revealed.value = true
      return
    }
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          revealed.value = true
          io?.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(target)
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  function replay() {
    io?.disconnect()
    clearTimeout(timer)
    revealed.value = false
    // Let the charts animate out before drawing them in again (as in the prototype).
    timer = setTimeout(observe, 700 * k() + 100)
  }

  onMounted(observe)
  onBeforeUnmount(() => {
    io?.disconnect()
    clearTimeout(timer)
  })
  if (ctx) watch(ctx.replayToken, replay)

  return { revealed, replay }
}
