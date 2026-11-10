import { Duration } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ses from 'aws-cdk-lib/aws-ses'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

import { STREAMS, type Stream } from './streams'

export interface SesEventsProps {
  /** Configuration set names are `${prefix}-${stream}`. */
  prefix: string
  /** HTTPS endpoint of dak-api that receives SNS notifications (`…/ingest/ses`). */
  ingestUrl: string
  /** Engagement tracking (open/click) events are only published for marketing-capable sets. */
  trackEngagement?: boolean
}

/**
 * SES configuration sets per stream, publishing every delivery and engagement event to one
 * SNS topic that pushes to dak-api over HTTPS. dak-api verifies each SNS signature.
 */
export class SesEvents extends Construct {
  readonly topic: sns.Topic
  readonly configurationSets: Record<Stream, ses.ConfigurationSet>

  constructor(scope: Construct, id: string, props: SesEventsProps) {
    super(scope, id)

    this.topic = new sns.Topic(this, 'Topic', {
      displayName: 'Dak SES events',
      enforceSSL: true,
    })
    this.topic.addSubscription(
      new subs.UrlSubscription(props.ingestUrl, {
        protocol: sns.SubscriptionProtocol.HTTPS,
        rawMessageDelivery: false,
        deliveryPolicy: {
          healthyRetryPolicy: {
            minDelayTarget: Duration.seconds(5),
            maxDelayTarget: Duration.minutes(5),
            numRetries: 100,
            backoffFunction: sns.BackoffFunction.EXPONENTIAL,
          },
          throttlePolicy: { maxReceivesPerSecond: 500 },
        },
      }),
    )
    this.topic.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['sns:Publish'],
        principals: [new iam.ServicePrincipal('ses.amazonaws.com')],
        resources: [this.topic.topicArn],
      }),
    )

    const delivery = [
      ses.EmailSendingEvent.SEND,
      ses.EmailSendingEvent.REJECT,
      ses.EmailSendingEvent.BOUNCE,
      ses.EmailSendingEvent.COMPLAINT,
      ses.EmailSendingEvent.DELIVERY,
      ses.EmailSendingEvent.DELIVERY_DELAY,
      ses.EmailSendingEvent.RENDERING_FAILURE,
    ]
    const engagement = [
      ses.EmailSendingEvent.OPEN,
      ses.EmailSendingEvent.CLICK,
      ses.EmailSendingEvent.SUBSCRIPTION,
    ]

    this.configurationSets = {} as Record<Stream, ses.ConfigurationSet>
    for (const stream of STREAMS) {
      const set = new ses.ConfigurationSet(this, `Set-${stream}`, {
        configurationSetName: `${props.prefix}-${stream}`,
        sendingEnabled: true,
        reputationMetrics: true,
        suppressionReasons: ses.SuppressionReasons.BOUNCES_AND_COMPLAINTS,
      })
      set.addEventDestination('ToDak', {
        destination: ses.EventDestination.snsTopic(this.topic),
        // Authentication mail never gets engagement tracking (no link rewriting on OTPs).
        events:
          props.trackEngagement !== false && stream !== 'authentication'
            ? [...delivery, ...engagement]
            : delivery,
      })
      this.configurationSets[stream] = set
    }
  }
}
