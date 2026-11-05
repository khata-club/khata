import { z } from 'zod'

/**
 * Environment kinds. `sandbox` routes every send to the test sink: messages are rendered and
 * outcomes simulated, but nothing reaches a real recipient or consumes production quota.
 */
export const EnvironmentKind = z.enum(['production', 'staging', 'sandbox'])
export type EnvironmentKind = z.infer<typeof EnvironmentKind>

/** Infrastructure mode of a project (spec §3). There is no fallback between modes. */
export const InfrastructureMode = z.enum(['platform', 'byo'])
export type InfrastructureMode = z.infer<typeof InfrastructureMode>
