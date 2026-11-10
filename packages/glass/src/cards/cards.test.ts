import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import GCreditCard from './GCreditCard.vue'

describe('GCreditCard', () => {
  it('describes the card for screen readers', () => {
    const w = mount(GCreditCard, {
      props: { holder: 'Ana Ruiz', number: '4000 1234 5678 4242', tier: 'Gold' },
    })
    expect(w.get('[role="img"]').attributes('aria-label')).toBe(
      'Gold card for Ana Ruiz, ending 4242',
    )
  })

  it('uses light ink on dark colours and dark ink on pale ones', () => {
    const dark = mount(GCreditCard, { props: { color: '#17181B' } })
      .get('[role="img"]')
      .attributes('style')!
    const pale = mount(GCreditCard, { props: { color: '#EFEBE4' } })
      .get('[role="img"]')
      .attributes('style')!
    const channel = (s: string) => Number(/color: rgb\((\d+)/.exec(s)![1])
    expect(channel(dark)).toBeGreaterThan(200)
    expect(channel(pale)).toBeLessThan(60)
  })

  it('falls back to the default colour for invalid hex', () => {
    const bad = mount(GCreditCard, { props: { color: 'not-a-colour' } })
      .get('[role="img"]')
      .attributes('style')
    const def = mount(GCreditCard).get('[role="img"]').attributes('style')
    expect(bad).toBe(def)
  })
})
