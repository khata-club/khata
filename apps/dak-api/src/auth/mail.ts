import type { AuthEnv } from '.'
import { sesSendEmail } from '../aws/ses'

export interface AuthEmail {
  to: string
  subject: string
  text: string
}

/**
 * Auth emails go straight through the platform SES account rather than Dak's own pipeline,
 * so sign-in never depends on the system it administers. In development they are logged.
 */
export async function sendAuthEmail(env: AuthEnv, mail: AuthEmail): Promise<void> {
  if (env.DAK_ENV !== 'production' || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.log(JSON.stringify({ level: 'info', msg: 'auth email (not sent)', ...mail }))
    return
  }
  await sesSendEmail(
    {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.DAK_SES_REGION ?? 'eu-west-1',
    },
    {
      FromEmailAddress: env.DAK_AUTH_FROM ?? 'Dak <no-reply@dak.khata.club>',
      Destination: { ToAddresses: [mail.to] },
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: mail.text, Charset: 'UTF-8' } },
        },
      },
    },
  )
}
