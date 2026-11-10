/**
 * Nightly end-to-end check against a deployed dev environment and the real SES mailbox
 * simulator (no real recipients). Requires a production-environment key of a project whose
 * domain is verified, e.g. in CI secrets:
 *
 *   DAK_API_URL=https://api.dev.dak.khata.club DAK_E2E_KEY=dak_live_… DAK_E2E_FROM=e2e@dev.acme.dev \
 *     pnpm --filter @khata/dak-api e2e:simulator
 */
import { Dak } from '@khata/dak'

const url = process.env.DAK_API_URL
const key = process.env.DAK_E2E_KEY
const from = process.env.DAK_E2E_FROM
if (!url || !key || !from) {
  console.log('Skipping: set DAK_API_URL, DAK_E2E_KEY and DAK_E2E_FROM.')
  process.exit(0)
}

const dak = new Dak({ apiKey: key, baseUrl: url })
const cases: Record<string, string> = {
  'success@simulator.amazonses.com': 'delivered',
  'bounce@simulator.amazonses.com': 'bounced',
  'complaint@simulator.amazonses.com': 'complained',
}

type Email = { recipients: { address: string; status: string }[] }
const deadline = Date.now() + 5 * 60_000
let failed = 0
for (const [to, expected] of Object.entries(cases)) {
  const { id } = await dak.request<{ id: string }>('POST', '/v1/emails', {
    from,
    to,
    subject: `Dak e2e ${expected}`,
    text: 'Mailbox simulator check.',
  })
  let status = 'pending'
  while (Date.now() < deadline) {
    const e = await dak.request<Email>('GET', `/v1/emails/${id}`)
    status = e.recipients[0]?.status ?? 'missing'
    if (status === expected) break
    await new Promise((r) => setTimeout(r, 5000))
  }
  const ok = status === expected
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${to}: ${status} (expected ${expected}) ${id}`)
}
process.exit(failed ? 1 : 0)
