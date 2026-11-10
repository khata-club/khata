import { eq } from 'drizzle-orm'

import { control, type ControlDb, type Scoped } from '../db'
import { HttpError } from '../lib/errors'
import { connectionCredentials, type BrokerEnv } from './credentials'
import type { AwsCredentials } from './ses'

export interface ProjectAws {
  creds: AwsCredentials
  /** Configuration sets are `${prefix}-${stream}`. */
  configurationSetPrefix: string
  mode: 'platform' | 'byo'
  connectionId?: string
}

export function platformPrefix(env: Pick<Env, 'DAK_ENV'>) {
  return env.DAK_ENV === 'production' ? 'dak-production' : 'dak-dev'
}

/** AWS context for a project: platform broker or its BYO connection. Never falls back. */
export async function projectAws(
  env: BrokerEnv,
  db: Scoped<ControlDb>,
  project: {
    id: string
    infrastructureMode: 'platform' | 'byo'
    awsConnectionId: string | null
    region: string
  },
): Promise<ProjectAws> {
  if (project.infrastructureMode === 'platform') {
    return {
      mode: 'platform',
      configurationSetPrefix: platformPrefix(env),
      creds: await connectionCredentials(env, {
        id: 'platform',
        mode: 'platform',
        region: project.region,
        roleArn: null,
        externalIdEnc: null,
        configurationSetPrefix: null,
      }),
    }
  }
  if (!project.awsConnectionId) {
    throw new HttpError(409, 'aws_not_connected', 'Connect an AWS account to this project first.')
  }
  const conn = await db.findFirst(
    control.awsConnection,
    eq(control.awsConnection.id, project.awsConnectionId),
  )
  if (!conn || conn.status === 'disconnected' || conn.status === 'disconnecting') {
    throw new HttpError(
      409,
      'aws_not_connected',
      'The AWS connection for this project is not active.',
    )
  }
  return {
    mode: 'byo',
    connectionId: conn.id,
    configurationSetPrefix: conn.configurationSetPrefix ?? `dak-${conn.id.slice(4)}`,
    creds: await connectionCredentials(env, conn),
  }
}
