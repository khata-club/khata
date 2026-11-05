import { newId } from '@khata/dak-core'
import { and, eq, ne } from 'drizzle-orm'

import { projectAws } from '../aws/project'
import { AwsError, sesV2 } from '../aws/ses'
import { control, databases, type ControlDb, type Scoped } from '../db'
import { HttpError } from '../lib/errors'
import { resolve } from './dns'
import { buildRecords, mailFromDomain, spfRecordsIn, type DnsRecord } from './records'

type Project = typeof control.project.$inferSelect
type Domain = typeof control.domain.$inferSelect

interface Identity {
  VerifiedForSendingStatus?: boolean
  DkimAttributes?: { Status?: string; Tokens?: string[] }
  MailFromAttributes?: { MailFromDomain?: string; MailFromDomainStatus?: string }
}

async function safeResolve(name: string, type: 'TXT' | 'CNAME' | 'MX') {
  try {
    return await resolve(name, type)
  } catch {
    return []
  }
}

/**
 * On the shared platform account an SES identity is account-wide, so one domain may belong
 * to only one Dak organization. (BYO accounts are the customer's own.)
 */
async function assertDomainFree(env: Env, organizationId: string, name: string) {
  const owner = await databases(env)
    .control.select({ organizationId: control.domain.organizationId })
    .from(control.domain)
    .innerJoin(control.project, eq(control.project.id, control.domain.projectId))
    .where(
      and(
        eq(control.domain.name, name),
        eq(control.project.infrastructureMode, 'platform'),
        ne(control.domain.organizationId, organizationId),
      ),
    )
    .limit(1)
  if (owner.length) {
    throw new HttpError(
      409,
      'domain_taken',
      'This domain is registered by another Dak organization.',
    )
  }
}

export async function createDomain(
  env: Env,
  db: Scoped<ControlDb>,
  project: Project,
  name: string,
) {
  const existing = await db.findFirst(
    control.domain,
    and(eq(control.domain.projectId, project.id), eq(control.domain.name, name)),
  )
  if (existing) throw new HttpError(409, 'conflict', 'This domain is already in the project.')
  if (project.infrastructureMode === 'platform')
    await assertDomainFree(env, db.tenant.organizationId, name)

  const aws = await projectAws(env, db, project)
  let identity: Identity
  try {
    identity = await sesV2<Identity>(aws.creds, 'POST', '/identities', {
      EmailIdentity: name,
      DkimSigningAttributes: { NextSigningKeyLength: 'RSA_2048_BIT' },
    })
  } catch (err) {
    if (err instanceof AwsError && err.code === 'AlreadyExistsException') {
      identity = await sesV2<Identity>(aws.creds, 'GET', `/identities/${encodeURIComponent(name)}`)
    } else throw err
  }

  const mailFrom = mailFromDomain(name)
  await sesV2(aws.creds, 'PUT', `/identities/${encodeURIComponent(name)}/mail-from`, {
    MailFromDomain: mailFrom,
    BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
  })

  const [mailFromTxt, dmarcTxt] = await Promise.all([
    safeResolve(mailFrom, 'TXT'),
    safeResolve(`_dmarc.${name}`, 'TXT'),
  ])
  const records = buildRecords({
    domain: name,
    region: project.region,
    dkimTokens: identity.DkimAttributes?.Tokens ?? [],
    mailFrom,
    existingMailFromTxt: mailFromTxt,
    existingDmarcTxt: dmarcTxt,
  })

  const id = newId('domain')
  await db.insert(control.domain, {
    id,
    projectId: project.id,
    name,
    region: project.region,
    status: 'pending',
    dkimStatus: identity.DkimAttributes?.Status?.toLowerCase() ?? 'pending',
    mailFromDomain: mailFrom,
    mailFromStatus: 'pending',
    records,
    lastCheckedAt: Date.now(),
  })
  return id
}

export interface DomainCheck {
  status: Domain['status']
  dkimStatus: string
  mailFromStatus: string
  spfStatus: 'pass' | 'missing' | 'multiple'
  dmarcStatus: 'present' | 'missing'
  records: DnsRecord[]
}

/** Re-reads SES verification state and the live DNS, then stores the result. */
export async function refreshDomain(
  env: Env,
  db: Scoped<ControlDb>,
  project: Project,
  domain: Domain,
): Promise<DomainCheck> {
  const aws = await projectAws(env, db, project)
  let identity: Identity
  let lastError: string | null = null
  try {
    identity = await sesV2<Identity>(
      aws.creds,
      'GET',
      `/identities/${encodeURIComponent(domain.name)}`,
    )
  } catch (err) {
    identity = {}
    lastError = err instanceof Error ? err.message : String(err)
  }

  const mailFrom = domain.mailFromDomain ?? mailFromDomain(domain.name)
  const [mailFromTxt, dmarcTxt] = await Promise.all([
    safeResolve(mailFrom, 'TXT'),
    safeResolve(`_dmarc.${domain.name}`, 'TXT'),
  ])
  const spf = spfRecordsIn(mailFromTxt)
  const check: DomainCheck = {
    dkimStatus: identity.DkimAttributes?.Status?.toLowerCase() ?? domain.dkimStatus,
    mailFromStatus: identity.MailFromAttributes?.MailFromDomainStatus?.toLowerCase() ?? 'pending',
    spfStatus:
      spf.length > 1 ? 'multiple' : spf[0]?.includes('include:amazonses.com') ? 'pass' : 'missing',
    dmarcStatus: dmarcTxt.some((t) => /v=DMARC1/i.test(t)) ? 'present' : 'missing',
    status: 'pending',
    records: buildRecords({
      domain: domain.name,
      region: domain.region,
      dkimTokens: identity.DkimAttributes?.Tokens ?? domainTokens(domain),
      mailFrom,
      existingMailFromTxt: mailFromTxt,
      existingDmarcTxt: dmarcTxt,
    }),
  }
  const verified = identity.VerifiedForSendingStatus === true && check.dkimStatus === 'success'
  check.status = verified
    ? 'verified'
    : check.dkimStatus === 'failed'
      ? 'failed'
      : check.dkimStatus === 'temporary_failure'
        ? 'temporary_failure'
        : 'pending'

  await db.update(
    control.domain,
    {
      status: check.status,
      dkimStatus: check.dkimStatus,
      mailFromStatus: check.mailFromStatus,
      spfStatus: check.spfStatus,
      dmarcStatus: check.dmarcStatus,
      records: check.records,
      lastError,
      lastCheckedAt: Date.now(),
      ...(verified && !domain.verifiedAt && { verifiedAt: Date.now() }),
    },
    eq(control.domain.id, domain.id),
  )
  return check
}

function domainTokens(domain: Domain): string[] {
  return (domain.records as DnsRecord[])
    .filter((r) => r.purpose === 'dkim')
    .map((r) => r.name.split('._domainkey.')[0]!)
}

export async function deleteDomain(
  env: Env,
  db: Scoped<ControlDb>,
  project: Project,
  domain: Domain,
) {
  const aws = await projectAws(env, db, project)
  try {
    await sesV2(aws.creds, 'DELETE', `/identities/${encodeURIComponent(domain.name)}`)
  } catch (err) {
    if (!(err instanceof AwsError && err.code === 'NotFoundException')) throw err
  }
  await db.db.batch([
    db.delete(control.sender, eq(control.sender.domainId, domain.id)),
    db.delete(control.domain, eq(control.domain.id, domain.id)),
  ])
}
