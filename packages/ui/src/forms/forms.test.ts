import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import KChoiceCards from './KChoiceCards.vue'
import KErrorSummary from './KErrorSummary.vue'
import KTextarea from './KTextarea.vue'
import KTextField from './KTextField.vue'

describe('KTextField', () => {
  it('wires status to ARIA and shows the message instead of the hint', () => {
    const w = mount(KTextField, {
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
    const w = mount(KTextField, {
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
      mount(KTextField, { props: { label: 'A', disabled: true } })
        .get('input')
        .attributes('disabled'),
    ).toBeDefined()
    expect(
      mount(KTextField, { props: { label: 'A', readonly: true } })
        .get('input')
        .attributes('readonly'),
    ).toBeDefined()
  })
})

describe('KTextarea', () => {
  it('shows a counter against the soft limit', () => {
    const w = mount(KTextarea, { props: { label: 'Notes', max: 200, modelValue: 'hello' } })
    expect(w.text()).toContain('5 / 200')
  })
})

describe('KChoiceCards', () => {
  it('renders a required radiogroup with ids for focusing', () => {
    const w = mount(KChoiceCards, {
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

describe('KErrorSummary', () => {
  it('lists errors as buttons and is programmatically focusable', () => {
    const w = mount(KErrorSummary, {
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
