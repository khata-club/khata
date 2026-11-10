import {
  computed,
  inject,
  provide,
  ref,
  toValue,
  watch,
  type ComponentPublicInstance,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import { useInView } from '../composables/useInView'
import { prefersReducedMotion, useReducedMotion } from '../composables/useReducedMotion'
import { PALETTES, type ChartPalette } from './lib/palette'

/**
 * Settings every chart accepts as props and KChartProvider sets for a subtree. A chart's own prop
 * wins over the provider, which wins over `CHART_DEFAULTS`.
 *
 * Charts must destructure `showGrid = undefined`: Vue casts an absent Boolean prop to `false`,
 * which would otherwise hide the grid and shadow the provider.
 */
export interface ChartSettings {
  /** Calm (multi-hue) or Monochrome (blues). */
  palette?: ChartPalette
  /** Animation speed multiplier: 2 = twice as fast. */
  animationSpeed?: number
  /** Show horizontal grid lines. */
  showGrid?: boolean
}

export const CHART_DEFAULTS: Required<ChartSettings> = {
  palette: 'Calm',
  animationSpeed: 1,
  showGrid: true,
}

interface ChartContext {
  settings: ComputedRef<ChartSettings>
  /** Incremented by `replay()`; charts watch it to re-run their entrance animations. */
  replayToken: Ref<number>
}

const KEY: InjectionKey<ChartContext> = Symbol('k-charts')

/** Called by KChartProvider. */
export function provideCharts(settings: ComputedRef<ChartSettings>) {
  const replayToken = ref(0)
  provide(KEY, { settings, replayToken })
  return { replay: () => replayToken.value++ }
}

/**
 * Resolved theme for one chart: palette colours, the duration multiplier (the `--k` CSS variable;
 * tiny under reduced motion), and grid opacity.
 */
export function useChartTheme(overrides: () => ChartSettings) {
  const ctx = inject(KEY, null)
  const reduced = useReducedMotion()
  return computed(() => {
    const own = overrides()
    const inherited = ctx?.settings.value ?? {}
    const palette = own.palette ?? inherited.palette ?? CHART_DEFAULTS.palette
    const speed = own.animationSpeed ?? inherited.animationSpeed ?? CHART_DEFAULTS.animationSpeed
    const showGrid = own.showGrid ?? inherited.showGrid ?? CHART_DEFAULTS.showGrid
    return {
      mono: palette === 'Monochrome',
      /** Categorical series colours; use `seriesColor()` to index past the end. */
      series: PALETTES[palette].series,
      /** Readable text colour on each series colour. */
      ink: PALETTES[palette].ink,
      durationScale: reduced.value ? 0.001 : Math.round((1 / Math.max(0.25, speed)) * 1000) / 1000,
      gridOpacity: showGrid ? 1 : 0,
    }
  })
}

export type ChartTheme = ReturnType<typeof useChartTheme>['value']

type RevealTarget = Element | ComponentPublicInstance | null | undefined

/**
 * Entrance state for a chart card: `revealed` flips to true once the card is 15% visible, and
 * resets (then re-observes) on `replay()` or when the provider replays everything.
 */
export function useChartReveal(
  el: MaybeRefOrGetter<RevealTarget>,
  /** Current duration multiplier (`theme.durationScale`): replay waits for the exit transition. */
  durationScale: () => number = () => 1,
) {
  const ctx = inject(KEY, null)
  const node = () => {
    const v = toValue(el)
    return v && '$el' in v ? (v.$el as Element) : v
  }
  const { inView: revealed, reset } = useInView(node, { skip: prefersReducedMotion })

  // Let the charts animate out before drawing them in again (as in the prototype).
  const replay = () => reset({ delay: 700 * durationScale() + 100 })
  if (ctx) watch(ctx.replayToken, replay)

  return { revealed, replay }
}
