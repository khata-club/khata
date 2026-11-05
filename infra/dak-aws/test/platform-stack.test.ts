import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'

import { DakByoRoleStack, synthByoTemplate } from '../lib/byo-role-stack'
import { DakPlatformStack } from '../lib/platform-stack'

describe('DakPlatformStack', () => {
  const app = new App()
  const stack = new DakPlatformStack(app, 'Test', {
    stage: 'dev',
    apiOrigin: 'https://api.test',
    byoTemplate: synthByoTemplate({
      brokerAccountId: '123456789012',
      ingestUrl: 'https://api.test/ingest/ses',
    }),
  })
  const t = Template.fromStack(stack)

  it('creates one configuration set per stream', () => {
    t.resourceCountIs('AWS::SES::ConfigurationSet', 4)
    for (const stream of ['authentication', 'transactional', 'notifications', 'marketing']) {
      t.hasResourceProperties('AWS::SES::ConfigurationSet', { Name: `dak-dev-${stream}` })
    }
  })

  it('never tracks engagement on authentication mail', () => {
    const dests = t.findResources('AWS::SES::ConfigurationSetEventDestination')
    const auth = Object.values(dests).find((d) =>
      JSON.stringify(d.Properties.ConfigurationSetName).includes('authentication'),
    )!
    const types: string[] = auth.Properties.EventDestination.MatchingEventTypes
    expect(types).toContain('bounce')
    expect(types).not.toContain('open')
    expect(types).not.toContain('click')
  })

  it('pushes events to dak-api over HTTPS with retries', () => {
    t.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'https',
      Endpoint: 'https://api.test/ingest/ses',
      DeliveryPolicy: Match.objectLike({
        healthyRetryPolicy: Match.objectLike({ numRetries: 100 }),
      }),
    })
    t.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Principal: { Service: 'ses.amazonaws.com' }, Action: 'sns:Publish' }),
        ]),
      }),
    })
  })

  it('limits the broker to assuming Dak roles and sending through Dak sets', () => {
    const policies = t.findResources('AWS::IAM::Policy')
    const statements = Object.values(policies).flatMap((p) => p.Properties.PolicyDocument.Statement)
    const assume = statements.find((s) => s.Sid === 'AssumeCustomerSendingRoles')
    expect(assume.Resource).toBe('arn:aws:iam::*:role/DakSending*')
    const send = statements.find((s) => s.Sid === 'SendThroughDakConfigurationSets')
    expect(send.Condition.StringLike['ses:ConfigurationSetName']).toEqual(['dak-dev-*'])
    t.resourceCountIs('AWS::IAM::AccessKey', 0)
  })

  it('publishes the BYO template publicly read-only', () => {
    t.hasOutput('ByoTemplateUrl', {})
    t.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Action: 's3:GetObject', Effect: 'Allow' })]),
      }),
    })
  })

  it('names resources by stage', () => {
    expect(stack.name('transactional')).toBe('dak-dev-transactional')
    expect(stack.tags.tagValues()).toEqual({ app: 'dak', stage: 'dev' })
  })
})

describe('DakByoRoleStack', () => {
  const app = new App()
  const stack = new DakByoRoleStack(app, 'Byo', {
    brokerAccountId: '123456789012',
    ingestUrl: 'https://api.test/ingest/ses',
  })
  const t = Template.fromStack(stack)
  const json = t.toJSON()

  it('is portable: no bootstrap parameters or rules', () => {
    expect(Object.keys(json.Parameters)).toEqual(['ExternalId', 'ConnectionId', 'IngestUrl'])
    expect(json.Rules).toBeUndefined()
    expect(json.Parameters.ExternalId.NoEcho).toBe(true)
  })

  it('trusts only the broker account with the external ID', () => {
    t.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Condition: { StringEquals: { 'sts:ExternalId': { Ref: 'ExternalId' } } },
            Principal: {
              AWS: {
                'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::123456789012:root']],
              },
            },
          }),
        ],
      }),
    })
  })

  it('creates its own configuration sets and event topic', () => {
    t.resourceCountIs('AWS::SES::ConfigurationSet', 4)
    t.hasResourceProperties('AWS::SNS::Subscription', { Endpoint: { Ref: 'IngestUrl' } })
    t.hasOutput('RoleArn', {})
  })
})
