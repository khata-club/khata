import { AwsClient } from 'aws4fetch'

import { AwsError, type AwsCredentials } from './ses'

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]
}

export interface AssumedRole extends AwsCredentials {
  expiresAt: number
  accountId: string
}

/** STS AssumeRole with an ExternalId, signed by the broker principal. */
export async function assumeRole(
  broker: AwsCredentials,
  input: { roleArn: string; externalId: string; sessionName: string; durationSeconds?: number },
): Promise<AssumedRole> {
  const client = new AwsClient({ ...broker, service: 'sts', region: broker.region, retries: 0 })
  const params = new URLSearchParams({
    Action: 'AssumeRole',
    Version: '2011-06-15',
    RoleArn: input.roleArn,
    ExternalId: input.externalId,
    RoleSessionName: input.sessionName.slice(0, 64),
    DurationSeconds: String(input.durationSeconds ?? 3600),
  })
  const res = await client.fetch(`https://sts.${broker.region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const xml = await res.text()
  if (!res.ok) {
    throw new AwsError(
      res.status,
      tag(xml, 'Code') ?? 'AssumeRoleFailed',
      tag(xml, 'Message') ?? xml.slice(0, 200),
    )
  }
  const accessKeyId = tag(xml, 'AccessKeyId')
  const secretAccessKey = tag(xml, 'SecretAccessKey')
  const sessionToken = tag(xml, 'SessionToken')
  const expiration = tag(xml, 'Expiration')
  if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
    throw new AwsError(502, 'MalformedResponse', 'STS returned no credentials')
  }
  const accountId = /arn:aws[^:]*:sts::(\d{12}):/.exec(tag(xml, 'Arn') ?? '')?.[1] ?? ''
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: broker.region,
    expiresAt: Date.parse(expiration),
    accountId,
  }
}
