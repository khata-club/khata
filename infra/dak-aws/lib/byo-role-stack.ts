import {
  App,
  CfnOutput,
  CfnParameter,
  DefaultStackSynthesizer,
  Fn,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'

import { SesEvents } from './ses-events'

export const BYO_ROLE_NAME_PREFIX = 'DakSending'

export interface DakByoRoleStackProps extends StackProps {
  /** Platform account that owns the broker user. */
  brokerAccountId: string
  /** Default ingest URL; customers rarely change it. */
  ingestUrl: string
}

/**
 * The template customers launch in their own AWS account (spec §3, customer-owned AWS).
 * It creates a role Dak assumes with an ExternalId (no long-lived customer keys), SES
 * configuration sets per stream and the SNS topic that reports events back to Dak.
 * Synthesized without bootstrap requirements so it runs in any account.
 */
export class DakByoRoleStack extends Stack {
  constructor(scope: Construct, id: string, props: DakByoRoleStackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new DefaultStackSynthesizer({ generateBootstrapVersionRule: false }),
      description: 'Dak: lets Dak send email through SES in this account using a scoped role.',
    })

    const externalId = new CfnParameter(this, 'ExternalId', {
      type: 'String',
      minLength: 16,
      noEcho: true,
      description: 'Shown in the Dak dashboard. Prevents confused-deputy access.',
    })
    const connectionId = new CfnParameter(this, 'ConnectionId', {
      type: 'String',
      allowedPattern: '^awc_[0-9A-Z]{26}$',
      description: 'Dak connection ID (shown in the Dak dashboard).',
    })
    const ingestUrl = new CfnParameter(this, 'IngestUrl', {
      type: 'String',
      default: props.ingestUrl,
      allowedPattern: '^https://.+',
    })

    const prefix = Fn.join('-', ['dak', Fn.select(1, Fn.split('_', connectionId.valueAsString))])
    const events = new SesEvents(this, 'SesEvents', { prefix, ingestUrl: ingestUrl.valueAsString })

    const role = new iam.Role(this, 'SendingRole', {
      roleName: Fn.join('-', [
        BYO_ROLE_NAME_PREFIX,
        Fn.select(1, Fn.split('_', connectionId.valueAsString)),
      ]),
      assumedBy: new iam.AccountPrincipal(props.brokerAccountId),
      externalIds: [externalId.valueAsString],
      maxSessionDuration: undefined,
      description: 'Assumed by Dak to send email and manage identities.',
    })
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SendThroughDakConfigurationSets',
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
        conditions: {
          StringLike: { 'ses:ConfigurationSetName': [Fn.join('', [prefix, '-*'])] },
        },
      }),
    )
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'InspectAndManageIdentities',
        actions: [
          'ses:GetAccount',
          'ses:ListEmailIdentities',
          'ses:CreateEmailIdentity',
          'ses:GetEmailIdentity',
          'ses:DeleteEmailIdentity',
          'ses:PutEmailIdentityMailFromAttributes',
          'ses:PutEmailIdentityConfigurationSetAttributes',
          'ses:GetConfigurationSet',
        ],
        resources: ['*'],
      }),
    )

    new CfnOutput(this, 'RoleArn', { value: role.roleArn })
    new CfnOutput(this, 'ConfigurationSetPrefix', { value: prefix })
    new CfnOutput(this, 'EventsTopicArn', { value: events.topic.topicArn })
  }
}

/** Synthesizes the customer template in an isolated app and returns it as JSON. */
export function synthByoTemplate(props: DakByoRoleStackProps): Record<string, unknown> {
  const app = new App()
  const stack = new DakByoRoleStack(app, 'DakByoRole', props)
  return app.synth().getStackByName(stack.stackName).template as Record<string, unknown>
}
