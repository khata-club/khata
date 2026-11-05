import { App } from 'aws-cdk-lib'

import { DakPlatformStack } from '../lib/platform-stack'

const app = new App()
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }

new DakPlatformStack(app, 'DakPlatformDev', { stage: 'dev', env })
new DakPlatformStack(app, 'DakPlatformProduction', {
  stage: 'production',
  env,
  terminationProtection: true,
})
