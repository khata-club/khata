import { describe, expect, it } from 'vitest'

import { isStreamQueue, queueKind } from '../src/queues'

describe('queueKind', () => {
  it('maps queue names with and without an environment suffix', () => {
    expect(queueKind('dak-auth')).toBe('authentication')
    expect(queueKind('dak-tx-dev')).toBe('transactional')
    expect(queueKind('dak-webhooks-dev')).toBe('webhooks')
  })

  it('rejects unknown queues', () => {
    expect(queueKind('dak-dlq-dev')).toBeUndefined()
    expect(queueKind('other')).toBeUndefined()
  })

  it('separates stream queues from internal ones', () => {
    expect(isStreamQueue('marketing')).toBe(true)
    expect(isStreamQueue('events')).toBe(false)
  })
})
