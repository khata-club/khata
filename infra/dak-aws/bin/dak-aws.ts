import { App } from 'aws-cdk-lib'
import { synthByoTemplate } from '../lib/byo-role-stack'
import { DakPlatformStack, type DakStage } from '../lib/platform-stack'

const app = new App()
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
const brokerAccountId = app.node.tryGetContext('brokerAccountId') ?? '111111111111'

const stages: { stage: DakStage; id: string; apiOrigin: string }[] = [
  { stage: 'dev', id: 'DakPlatformDev', apiOrigin: 'https://api.dev.dak.khata.club' },
  { stage: 'production', id: 'DakPlatformProduction', apiOrigin: 'https://api.dak.khata.club' },
]

for (const s of stages) {
  new DakPlatformStack(app, s.id, {
    stage: s.stage,
    env,
    apiOrigin: s.apiOrigin,
    // The customer template is synthesized separately, then published by the platform.
    byoTemplate: synthByoTemplate({ brokerAccountId, ingestUrl: `${s.apiOrigin}/ingest/ses` }),
    terminationProtection: s.stage === 'production',
  })
}
