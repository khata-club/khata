import { CfnOutput, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import type { Construct } from 'constructs'

import { BYO_ROLE_NAME_PREFIX } from './byo-role-stack'
import { SesEvents } from './ses-events'

export type DakStage = 'dev' | 'production'

export interface DakPlatformStackProps extends StackProps {
  stage: DakStage
  /** Public dak-api origin, e.g. `https://api.dak.khata.club`. */
  apiOrigin: string
  /** Synthesized BYO CloudFormation template, published for one-click customer setup. */
  byoTemplate?: Record<string, unknown>
}

/**
 * The platform-owned AWS account: SES configuration sets per stream, the SNS event topic with
 * its HTTPS subscription to dak-api, the least-privilege broker user Workers sign requests
 * with (decision D2), and a public bucket hosting the BYO template.
 */
export class DakPlatformStack extends Stack {
  readonly stage: DakStage
  readonly events: SesEvents
  readonly broker: iam.User

  constructor(scope: Construct, id: string, props: DakPlatformStackProps) {
    super(scope, id, props)
    this.stage = props.stage

    Tags.of(this).add('app', 'dak')
    Tags.of(this).add('stage', props.stage)

    this.events = new SesEvents(this, 'SesEvents', {
      prefix: this.name(''),
      ingestUrl: `${props.apiOrigin}/ingest/ses`,
    })

    // Workers cannot assume roles natively, so dak-api signs with this user's access key
    // (created out of band and stored as a Workers secret, never in CloudFormation).
    this.broker = new iam.User(this, 'Broker', { userName: this.name('broker') })
    this.broker.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCustomerSendingRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::*:role/${BYO_ROLE_NAME_PREFIX}*`],
      }),
    )
    this.broker.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SendThroughDakConfigurationSets',
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
        conditions: {
          StringLike: { 'ses:ConfigurationSetName': [`${this.name('')}-*`] },
        },
      }),
    )
    this.broker.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ManagePlatformIdentities',
        actions: [
          'ses:GetAccount',
          'ses:CreateEmailIdentity',
          'ses:GetEmailIdentity',
          'ses:DeleteEmailIdentity',
          'ses:PutEmailIdentityMailFromAttributes',
          'ses:PutEmailIdentityConfigurationSetAttributes',
          'ses:ListEmailIdentities',
          'ses:CreateTenant',
          'ses:CreateTenantResourceAssociation',
        ],
        resources: ['*'],
      }),
    )

    const publicBucket = new s3.Bucket(this, 'Public', {
      bucketName: this.name('public-templates'),
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    publicBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [publicBucket.arnForObjects('templates/*')],
      }),
    )
    if (props.byoTemplate) {
      new s3deploy.BucketDeployment(this, 'ByoTemplate', {
        destinationBucket: publicBucket,
        destinationKeyPrefix: 'templates',
        sources: [s3deploy.Source.jsonData('dak-byo-role.json', props.byoTemplate)],
        prune: false,
      })
    }

    new CfnOutput(this, 'Stage', { value: props.stage })
    new CfnOutput(this, 'EventsTopicArn', { value: this.events.topic.topicArn })
    new CfnOutput(this, 'BrokerUserArn', { value: this.broker.userArn })
    new CfnOutput(this, 'ByoTemplateUrl', {
      value: `https://${publicBucket.bucketRegionalDomainName}/templates/dak-byo-role.json`,
    })
  }

  /** Physical name for a stage-scoped resource, e.g. `dak-dev-transactional`. */
  name(suffix: string): string {
    return suffix ? `dak-${this.stage}-${suffix}` : `dak-${this.stage}`
  }
}
