import { type Sequence, clipEnd } from './model'
import type { Ticks } from './time'

export type SnapKind = 'clip' | 'playhead' | 'marker' | 'in' | 'out' | 'zero'

export interface SnapPoint {
  t: Ticks
  kind: SnapKind
}

/**
 * Sorted snap targets for a sequence. Build once per gesture (O(n log n)); each query is
 * O(log n), so dragging stays constant-time regardless of project size.
 */
export class SnapIndex {
  private readonly points: SnapPoint[]

  constructor(points: SnapPoint[]) {
    this.points = points.slice().sort((a, b) => a.t - b.t)
  }

  static fromSequence(
    seq: Sequence,
    opts: { playhead?: Ticks; excludeClipIds?: ReadonlySet<string> } = {},
  ): SnapIndex {
    const pts: SnapPoint[] = [{ t: 0, kind: 'zero' }]
    for (const tr of seq.tracks)
      for (const c of tr.clips) {
        if (opts.excludeClipIds?.has(c.id)) continue
        pts.push({ t: c.start, kind: 'clip' }, { t: clipEnd(c), kind: 'clip' })
      }
    for (const m of seq.markers) pts.push({ t: m.t, kind: 'marker' })
    if (opts.playhead !== undefined) pts.push({ t: opts.playhead, kind: 'playhead' })
    if (seq.inPoint !== undefined) pts.push({ t: seq.inPoint, kind: 'in' })
    if (seq.outPoint !== undefined) pts.push({ t: seq.outPoint, kind: 'out' })
    return new SnapIndex(pts)
  }

  get size(): number {
    return this.points.length
  }

  /** Nearest point to `t` within `threshold`, or undefined. */
  nearest(t: Ticks, threshold: Ticks): SnapPoint | undefined {
    const pts = this.points
    if (!pts.length) return undefined
    let lo = 0
    let hi = pts.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (pts[mid]!.t < t) lo = mid + 1
      else hi = mid
    }
    let best: SnapPoint | undefined
    let bestD = threshold
    for (const i of [lo - 1, lo]) {
      const p = pts[i]
      if (!p) continue
      const d = Math.abs(p.t - t)
      if (d <= bestD) {
        best = p
        bestD = d
      }
    }
    return best
  }

  /**
   * Snap a moving span `[start, start + duration)`: whichever edge lands closer to a target wins.
   * Returns the adjusted start and the point snapped to (for drawing a guide).
   */
  snapSpan(start: Ticks, duration: Ticks, threshold: Ticks): { start: Ticks; point?: SnapPoint } {
    const a = this.nearest(start, threshold)
    const b = this.nearest(start + duration, threshold)
    const da = a ? Math.abs(a.t - start) : Number.POSITIVE_INFINITY
    const db = b ? Math.abs(b.t - (start + duration)) : Number.POSITIVE_INFINITY
    if (a && da <= db) return { start: a.t, point: a }
    if (b) return { start: b.t - duration, point: b }
    return { start }
  }
}
