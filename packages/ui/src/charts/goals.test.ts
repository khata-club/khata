import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { creditScore, goals } from './fixtures/finance'
import KGauge from './KGauge.vue'
import KProgressRings from './KProgressRings.vue'

// Charts/Goals stories (14–16).

describe('KGauge', () => {
  it('names the active band', () => {
    const w = mount(KGauge, { props: creditScore })
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Very good')
  })

  it('matches fractional values that fall between integer bands', () => {
    const w = mount(KGauge, { props: { ...creditScore, value: 579.5 } })
    expect(w.get('[role="img"]').attributes('aria-label')).toContain('Poor')
  })

  it('pins an out-of-range value to the end of the arc', async () => {
    const w = mount(KGauge, { props: { ...creditScore, value: 2000 } })
    await nextTick() // the reveal flips on mount
    expect(w.html()).toContain('rotate(180deg)')
  })
})

describe('KProgressRings', () => {
  it('shows each goal percentage', () => {
    const w = mount(KProgressRings, { props: { goals } })
    expect(w.text()).toContain('82%')
    expect(w.text()).toContain('23%')
  })

  it('treats a goal with no target as complete rather than NaN%', () => {
    const w = mount(KProgressRings, { props: { goals: [{ label: 'Gift', saved: 10, target: 0 }] } })
    expect(w.text()).toContain('100%')
    expect(w.html()).not.toContain('NaN')
  })
})
