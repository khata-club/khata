import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import GChoiceCards from './GChoiceCards.vue'
import GErrorSummary from './GErrorSummary.vue'
import GTextarea from './GTextarea.vue'
import GTextField from './GTextField.vue'

describe('GTextField', () => {
  it('wires status to ARIA and shows the message instead of the hint', () => {
    const w = mount(GTextField, {
      props: {
        label: 'Email',
        id: 'e',
        hint: 'Hint',
        status: 'error',
        message: 'Bad email',
        required: true,
      },
    })
    const input = w.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-required')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('e-help')
    expect(w.get('#e-help').text()).toBe('Bad email')
    expect(w.get('label').attributes('for')).toBe('e')
  })

  it('marks loading as busy and passes native attributes to the input', () => {
    const w = mount(GTextField, {
      props: { label: 'Email', status: 'loading' },
      attrs: { type: 'email', autocomplete: 'email' },
    })
    const input = w.get('input')
    expect(input.attributes('aria-busy')).toBe('true')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('autocomplete')).toBe('email')
  })

  it('disables and renders read-only', () => {
    expect(
      mount(GTextField, { props: { label: 'A', disabled: true } })
        .get('input')
        .attributes('disabled'),
    ).toBeDefined()
    expect(
      mount(GTextField, { props: { label: 'A', readonly: true } })
        .get('input')
        .attributes('readonly'),
    ).toBeDefined()
  })
})

describe('GTextarea', () => {
  it('shows a counter against the soft limit', () => {
    const w = mount(GTextarea, { props: { label: 'Notes', max: 200, modelValue: 'hello' } })
    expect(w.text()).toContain('5 / 200')
  })
})

describe('GChoiceCards', () => {
  it('renders a required radiogroup with ids for focusing', () => {
    const w = mount(GChoiceCards, {
      props: {
        label: 'Team size',
        idPrefix: 'size',
        invalid: true,
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
        ],
      },
    })
    expect(w.get('[role="radiogroup"]').attributes('aria-invalid')).toBe('true')
    expect(w.find('#size-0').exists()).toBe(true)
    expect(w.get('#size-1').attributes('data-disabled')).toBeDefined()
  })
})

describe('GErrorSummary', () => {
  it('lists errors as buttons and is programmatically focusable', () => {
    const w = mount(GErrorSummary, {
      props: {
        title: '2 fields need attention',
        items: [{ id: 'f-a', label: 'A', message: 'Required' }],
      },
      attachTo: document.body,
    })
    expect(w.get('[role="alert"]').attributes('tabindex')).toBe('-1')
    expect(w.findAll('li button')).toHaveLength(1)
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement?.getAttribute('data-slot')).toBe('error-summary')
    w.unmount()
  })
})
