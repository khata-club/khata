/** Workspace-setup form model and rules (ported from the Calm Kit Forms prototype). */

export interface FormValues {
  firstName: string
  lastName: string
  email: string
  phoneCode: string
  phone: string
  workspace: string
  slug: string
  size: string
  industry: string
  cycle: 'monthly' | 'yearly'
  card: string
  expiry: string
  cvc: string
  vat: string
  updates: boolean
  digest: boolean
  security: boolean
  twofa: boolean
  sso: boolean
  notes: string
  terms: boolean
}

export type FieldName =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'workspace'
  | 'industry'
  | 'slug'
  | 'size'
  | 'card'
  | 'expiry'
  | 'cvc'
  | 'notes'
  | 'terms'

export interface Check {
  err?: string
  warn?: string
  ok?: string
}

export interface EmailCheck {
  value: string
  ok: boolean
}

export const BLANK: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phoneCode: '+1',
  phone: '',
  workspace: '',
  slug: '',
  size: '',
  industry: '',
  cycle: 'yearly',
  card: '',
  expiry: '',
  cvc: '',
  vat: 'GB 284 1937 22',
  updates: false,
  digest: false,
  security: true,
  twofa: true,
  sso: false,
  notes: '',
  terms: false,
}
export const PARTIAL: FormValues = {
  ...BLANK,
  firstName: 'Olivia',
  email: 'olivia@northwind',
  phone: '415 555',
  workspace: 'Northwind Studio',
  slug: 'northwind-studio',
  industry: 'design',
  card: '4242 4242 4242',
  expiry: '08/24',
  cvc: '123',
  updates: true,
  notes:
    'Migrating from spreadsheets. We need guest access for two contractors and a shared client folder.',
}
export const COMPLETE: FormValues = {
  ...PARTIAL,
  lastName: 'Bennett',
  email: 'olivia@northwind.co',
  phone: '415 555 0132',
  size: '11-50',
  card: '4242 4242 4242 4242',
  expiry: '08/29',
  terms: true,
}

export const LABELS: Record<FieldName, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  phone: 'Phone',
  workspace: 'Workspace name',
  slug: 'Workspace URL',
  size: 'Team size',
  industry: 'Industry',
  card: 'Card number',
  expiry: 'Expiry',
  cvc: 'CVC',
  notes: 'Notes',
  terms: 'Terms',
}
export const HELP: Partial<Record<FieldName, string>> = {
  email: 'We’ll send a confirmation link here.',
  phone: 'Used for account recovery only.',
  slug: 'Lowercase letters, numbers and hyphens.',
  cvc: '3 or 4 digits on the back.',
  expiry: 'As printed on the card.',
  notes: 'Shared with your onboarding specialist.',
  workspace: 'You can rename it later.',
}
/** Fields that show a positive ("valid") state once checked. */
export const POSITIVE: FieldName[] = ['email', 'slug', 'card', 'expiry', 'cvc']
const PERSONAL = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com']
const TAKEN = ['acme', 'calm', 'admin', 'northwind']

export const SECTIONS: { id: string; title: string; fields: FieldName[] }[] = [
  { id: 'account', title: 'Account owner', fields: ['firstName', 'lastName', 'email', 'phone'] },
  { id: 'workspace', title: 'Workspace', fields: ['workspace', 'industry', 'slug', 'size'] },
  { id: 'billing', title: 'Billing', fields: ['card', 'expiry', 'cvc'] },
  { id: 'preferences', title: 'Preferences', fields: ['notes', 'terms'] },
]
export const ALL: FieldName[] = SECTIONS.flatMap((s) => s.fields)
export const REQUIRED: FieldName[] = [
  'firstName',
  'lastName',
  'email',
  'workspace',
  'industry',
  'slug',
  'size',
  'card',
  'expiry',
  'cvc',
  'terms',
]

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i

export const isEmailShaped = (s: string) => EMAIL_RE.test(s.trim())

export function check(
  name: FieldName,
  v: FormValues,
  emailCheck: EmailCheck | null = null,
  now: Date = new Date(),
): Check {
  const raw = v[name]
  const t = typeof raw === 'string' ? raw.trim() : raw
  switch (name) {
    case 'firstName':
      return t ? {} : { err: 'Enter your first name' }
    case 'lastName':
      // Deliberately long: exercises multi-line error wrapping in a half-width field.
      return t ? {} : { err: 'This cannot be the same as one of your last 3 passwords.' }
    case 'email': {
      const s = t as string
      if (!s) return { err: 'Enter your work email' }
      if (!EMAIL_RE.test(s)) return { err: 'Use the format name@company.com' }
      const c = emailCheck && emailCheck.value === s ? emailCheck : null
      if (c && !c.ok) return { err: 'This email already owns a workspace. Sign in instead.' }
      if (PERSONAL.includes(s.split('@')[1]!.toLowerCase()))
        return { warn: 'Personal address. Teammates can’t auto-join from this domain.' }
      if (c?.ok) return { ok: 'Verified and available' }
      return {}
    }
    case 'phone': {
      const d = (t as string).replace(/\D/g, '')
      return d && d.length < 10 ? { warn: 'Looks short. Include your area code.' } : {}
    }
    case 'workspace':
      return !t
        ? { err: 'Name your workspace' }
        : (t as string).length < 3
          ? { err: 'Use at least 3 characters' }
          : {}
    case 'slug': {
      const s = t as string
      if (!s) return { err: 'Choose a URL' }
      if (!/^[a-z0-9-]+$/.test(s)) return { err: 'Lowercase letters, numbers and hyphens only' }
      if (TAKEN.includes(s)) return { err: `khata.club/${s} is already taken` }
      return { ok: `khata.club/${s} is available` }
    }
    case 'size':
      return t ? {} : { err: 'Choose a team size' }
    case 'industry':
      return t ? {} : { err: 'Select an industry' }
    case 'card': {
      const d = (t as string).replace(/\D/g, '')
      if (!d) return { err: 'Enter a card number' }
      if (d.length < 16) {
        const n = 16 - d.length
        return { err: `${n} digit${n === 1 ? '' : 's'} short` }
      }
      return { ok: `Visa ending ${d.slice(-4)}` }
    }
    case 'expiry': {
      const s = t as string
      if (!s) return { err: 'Enter the expiry date' }
      const m = s.match(/^(\d{2})\/(\d{2})$/)
      if (!m) return { err: 'Use MM/YY' }
      const mm = +m[1]!
      const yy = +m[2]!
      if (mm < 1 || mm > 12) return { err: 'Month must be 01–12' }
      if (new Date(2000 + yy, mm, 1) <= now) return { err: 'This card has expired' }
      return { ok: 'Valid until ' + s }
    }
    case 'cvc':
      return !t
        ? { err: 'Enter the CVC' }
        : !/^\d{3,4}$/.test(t as string)
          ? { err: '3 or 4 digits' }
          : { ok: 'Looks good' }
    case 'notes': {
      const n = (raw as string).length
      return n > 200
        ? { err: `${n - 200} characters over the limit` }
        : n > 170
          ? { warn: `${200 - n} characters left` }
          : {}
    }
    case 'terms':
      return raw ? {} : { err: 'Accept the terms to continue' }
  }
}

/** Input masks applied as the user types. */
export function mask(name: string, value: string): string {
  if (name === 'card')
    return value
      .replace(/\D/g, '')
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, '$1 ')
  if (name === 'expiry') {
    const d = value.replace(/\D/g, '').slice(0, 4)
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d
  }
  if (name === 'cvc') return value.replace(/\D/g, '').slice(0, 4)
  if (name === 'phone') return value.replace(/[^\d\s()-]/g, '').slice(0, 18)
  return value
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
