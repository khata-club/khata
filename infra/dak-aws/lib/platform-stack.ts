import { CfnOutput, Stack, Tags, type StackProps } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export type DakStage = 'dev' | 'production'

export interface DakPlatformStackProps extends StackProps {
  stage: DakStage
}

/**
 * The platform-owned AWS account: SES configuration sets per stream, the SNS event topic with
 * its HTTPS subscription to dak-api, and the least-privilege broker principal. Resources are
 * added in Dak 7/22; this scaffold fixes the stack identity, naming and tagging.
 */
export class DakPlatformStack extends Stack {
  readonly stage: DakStage

  constructor(scope: Construct, id: string, props: DakPlatformStackProps) {
    super(scope, id, props)
    this.stage = props.stage

    Tags.of(this).add('app', 'dak')
    Tags.of(this).add('stage', props.stage)

    new CfnOutput(this, 'Stage', { value: props.stage })
  }

  /** Physical name for a stage-scoped resource, e.g. `dak-dev-transactional`. */
  name(suffix: string): string {
    return `dak-${this.stage}-${suffix}`
  }
}
