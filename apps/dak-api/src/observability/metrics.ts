/**
 * Pipeline telemetry (spec §8). Stage latencies go to Workers Analytics Engine for
 * high-volume dashboards and to OTel-compatible logs. Only a safe attribute subset is
 * recorded: IDs and enums, never bodies, tokens or recipient addresses.
 */

export type Stage =
  'api' | 'render' | 'queue' | 'provider' | 'delivery' | 'event_ingest' | 'webhook'

export interface StagePoint {
  organizationId: string
  projectId?: string
  environmentId?: string
  stage: Stage
  stream?: string
  outcome?: string
  latencyMs: number
}

export function recordStage(env: Pick<Env, 'METRICS'>, p: StagePoint) {
  try {
    env.METRICS?.writeDataPoint({
      indexes: [p.organizationId],
      blobs: [p.stage, p.projectId ?? '', p.environmentId ?? '', p.stream ?? '', p.outcome ?? ''],
      doubles: [Math.max(0, p.latencyMs)],
    })
  } catch {
    // Telemetry must never fail the request.
  }
}

/** Nearest-rank percentile over an unsorted sample. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[rank]!
}

export function summarize(values: number[]) {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  }
}
