import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'

import { DakPlatformStack } from '../lib/platform-stack'

describe('DakPlatformStack', () => {
  const app = new App()
  const stack = new DakPlatformStack(app, 'Test', { stage: 'dev' })
  const template = Template.fromStack(stack)

  it('exports its stage', () => {
    template.hasOutput('Stage', { Value: 'dev' })
  })

  it('names resources by stage', () => {
    expect(stack.name('transactional')).toBe('dak-dev-transactional')
  })

  it('tags the stack', () => {
    expect(stack.tags.tagValues()).toEqual({ app: 'dak', stage: 'dev' })
  })
})
