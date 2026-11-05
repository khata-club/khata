import { AwsClient } from 'aws4fetch'

export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
}

export class AwsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AwsError'
  }
}

export function sesClient(creds: AwsCredentials): AwsClient {
  return new AwsClient({ ...creds, service: 'ses', retries: 0 })
}

/** SES v2 JSON API call. Throws AwsError with the AWS error type on non-2xx. */
export async function sesV2<T>(
  creds: AwsCredentials,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  init: { signal?: AbortSignal } = {},
): Promise<T> {
  const res = await sesClient(creds).fetch(
    `https://email.${creds.region}.amazonaws.com/v2/email${path}`,
    {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: init.signal,
    },
  )
  const text = await res.text()
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  if (!res.ok) {
    const code = (
      res.headers.get('x-amzn-errortype') ?? String(data.__type ?? 'UnknownError')
    ).split(':')[0]!
    throw new AwsError(res.status, code, String(data.message ?? data.Message ?? res.statusText))
  }
  return data as T
}

export function sesSendEmail(creds: AwsCredentials, input: Record<string, unknown>) {
  return sesV2<{ MessageId: string }>(creds, 'POST', '/outbound-emails', input)
}
