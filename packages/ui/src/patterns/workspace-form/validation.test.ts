import { describe, expect, it } from 'vitest'

import { BLANK, COMPLETE, PARTIAL, check, mask, slugify } from './validation'

const now = new Date(2026, 10, 4)

describe('workspace form validation', () => {
  it('flags required fields on a blank form', () => {
    expect(check('firstName', BLANK).err).toBe('Enter your first name')
    expect(check('terms', BLANK).err).toBe('Accept the terms to continue')
    expect(check('size', BLANK).err).toBe('Choose a team size')
  })

  it('keeps the deliberately long multi-line last-name error', () => {
    expect(check('lastName', BLANK).err).toBe(
      'Enter your last name as it appears on your ID or payment card.',
    )
  })

  it('checks email format, personal domains and the availability result', () => {
    expect(check('email', PARTIAL).err).toBe('Use the format name@company.com')
    expect(check('email', { ...BLANK, email: 'me@gmail.com' }).warn).toMatch(/Personal address/)
    const v = { ...BLANK, email: 'admin@north.co' }
    expect(check('email', v, { value: 'admin@north.co', ok: false }).err).toMatch(/already owns/)
    expect(check('email', COMPLETE, { value: COMPLETE.email, ok: true }).ok).toBe(
      'Verified and available',
    )
  })

  it('validates slug, card, expiry and cvc', () => {
    expect(check('slug', { ...BLANK, slug: 'acme' }).err).toBe('calm.app/acme is already taken')
    expect(check('slug', { ...BLANK, slug: 'Bad Slug' }).err).toMatch(/Lowercase/)
    expect(check('card', PARTIAL).err).toBe('4 digits short')
    expect(check('card', COMPLETE).ok).toBe('Visa ending 4242')
    expect(check('expiry', PARTIAL, null, now).err).toBe('This card has expired')
    expect(check('expiry', { ...BLANK, expiry: '13/30' }, null, now).err).toBe(
      'Month must be 01–12',
    )
    expect(check('expiry', COMPLETE, null, now).ok).toBe('Valid until 08/29')
    expect(check('cvc', { ...BLANK, cvc: '12' }).err).toBe('3 or 4 digits')
  })

  it('warns as notes approach the limit and errors past it', () => {
    expect(check('notes', { ...BLANK, notes: 'x'.repeat(180) }).warn).toBe('20 characters left')
    expect(check('notes', { ...BLANK, notes: 'x'.repeat(205) }).err).toBe(
      '5 characters over the limit',
    )
  })

  it('masks card, expiry and cvc input and slugifies names', () => {
    expect(mask('card', '4242424242424242999')).toBe('4242 4242 4242 4242')
    expect(mask('expiry', '0829')).toBe('08/29')
    expect(mask('cvc', '12a34')).toBe('1234')
    expect(slugify('  Northwind Studio! ')).toBe('northwind-studio')
  })
})
