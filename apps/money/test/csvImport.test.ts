import { describe, expect, it } from 'vitest'

import { applyMapping, guessMapping, parseDate, parseSigned } from '../src/lib/csvImport'

describe('CSV import mapping', () => {
  it('reads Indian statement dates', () => {
    expect(parseDate('05/11/2026')).toBe('2026-11-05')
    expect(parseDate('5-11-26')).toBe('2026-11-05')
    expect(parseDate('05 Nov 2026')).toBe('2026-11-05')
    expect(parseDate('05-Nov-2026')).toBe('2026-11-05')
    expect(parseDate('2026-11-05')).toBe('2026-11-05')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('hello')).toBeNull()
  })
  it('reads signed amounts', () => {
    expect(parseSigned('-1,200.00')).toBe(-1200_00)
    expect(parseSigned('(1,200.00)')).toBe(-1200_00)
    expect(parseSigned('1,200 Dr')).toBe(-1200_00)
    expect(parseSigned('₹500 CR')).toBe(500_00)
    expect(parseSigned('')).toBeNull()
  })
  it('maps a debit/credit bank statement', () => {
    const headers = [
      'Date',
      'Narration',
      'Chq./Ref.No.',
      'Withdrawal Amt.',
      'Deposit Amt.',
      'Closing Balance',
    ]
    const map = guessMapping(headers)
    expect(map).toMatchObject({
      date: 'Date',
      amountMode: 'split',
      debit: 'Withdrawal Amt.',
      credit: 'Deposit Amt.',
      payee: 'Narration',
    })
    const out = applyMapping(
      [
        {
          Date: '01/10/26',
          Narration: 'UPI-SWIGGY-12345',
          'Withdrawal Amt.': '450.00',
          'Deposit Amt.': '',
          'Closing Balance': '1000',
        },
        {
          Date: '02/10/26',
          Narration: 'NEFT SALARY ACME',
          'Withdrawal Amt.': '',
          'Deposit Amt.': '85,000.00',
          'Closing Balance': '86000',
        },
        {
          Date: '',
          Narration: 'Opening balance',
          'Withdrawal Amt.': '',
          'Deposit Amt.': '',
          'Closing Balance': '550',
        },
        {
          Date: 'bad',
          Narration: 'x',
          'Withdrawal Amt.': '10',
          'Deposit Amt.': '',
          'Closing Balance': '',
        },
      ],
      map,
    )
    expect(out.rows).toEqual([
      {
        occurredOn: '2026-10-01',
        type: 'expense',
        amount: 450_00,
        payee: 'UPI-SWIGGY-12345',
        category: null,
        note: null,
      },
      {
        occurredOn: '2026-10-02',
        type: 'income',
        amount: 85_000_00,
        payee: 'NEFT SALARY ACME',
        category: null,
        note: null,
      },
    ])
    expect(out.errors).toEqual([{ line: 5, message: 'Can’t read the date “bad”' }])
  })
  it('maps a single signed amount column', () => {
    const out = applyMapping(
      [
        { d: '2026-10-01', a: '-200', p: 'Chai' },
        { d: '2026-10-02', a: '300', p: 'Refund' },
      ],
      {
        date: 'd',
        amountMode: 'single',
        amount: 'a',
        positiveIs: 'income',
        payee: 'p',
      },
    )
    expect(out.rows.map((r) => [r.type, r.amount])).toEqual([
      ['expense', 200_00],
      ['income', 300_00],
    ])
  })
})
