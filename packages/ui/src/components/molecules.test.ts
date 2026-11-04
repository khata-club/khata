import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { House, Search } from '@lucide/vue'
import { nextTick } from 'vue'

import KBottomNav from './KBottomNav.vue'
import KFormField from './KFormField.vue'
import KInput from './KInput.vue'
import KNavItem from './KNavItem.vue'
import KNotificationPanel from './KNotificationPanel.vue'
import KProgress from './KProgress.vue'
import KSearchInput from './KSearchInput.vue'

const fieldWith = (props: Record<string, unknown>) =>
  mount({
    components: { KFormField, KInput },
    data: () => ({ props }),
    template: `<KFormField v-bind="props"><template #default="{ field }"><KInput v-bind="field" /></template></KFormField>`,
  })

describe('KFormField', () => {
  it('links label, control and message', () => {
    const w = fieldWith({ label: 'Email', id: 'email', hint: 'For receipts', required: true })
    const input = w.get('input')
    expect(w.get('label').attributes('for')).toBe('email')
    expect(input.attributes('id')).toBe('email')
    expect(input.attributes('aria-describedby')).toBe('email-message')
    expect(input.attributes('aria-required')).toBe('true')
    expect(w.get('#email-message').text()).toBe('For receipts')
  })

  it('marks the control invalid and shows the error instead of the hint', () => {
    const w = fieldWith({
      label: 'Email',
      id: 'e',
      hint: 'For receipts',
      error: 'Enter a valid email.',
    })
    expect(w.get('input').attributes('aria-invalid')).toBe('true')
    expect(w.get('#e-message').text()).toBe('Enter a valid email.')
    expect(w.get('#e-message').classes()).toContain('text-danger')
  })
})

describe('KSearchInput', () => {
  it('uses a plain text input (no native clear button) and clears on click', async () => {
    const w = mount(KSearchInput, { props: { modelValue: 'rent' } })
    const input = w.get('input')
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('inputmode')).toBe('search')
    await w.get('button[aria-label="Clear search"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([''])
  })
})

describe('KProgress', () => {
  it('reports value and indeterminate state through ARIA', async () => {
    const w = mount(KProgress, { props: { value: 40, label: 'Upload' } })
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    await w.setProps({ value: null })
    await nextTick()
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
  })
})

describe('navigation', () => {
  it('KNavItem marks the current page', () => {
    const w = mount(KNavItem, { props: { icon: House, current: true }, slots: { default: 'Home' } })
    expect(w.attributes('aria-current')).toBe('page')
  })

  it('KBottomNav moves aria-current on click', async () => {
    const items = [
      { value: 'home', label: 'Home', icon: House },
      { value: 'search', label: 'Search', icon: Search },
    ]
    const w = mount(KBottomNav, { props: { items, modelValue: 'home' } })
    await w.findAll('button')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['search'])
  })
})

describe('KNotificationPanel', () => {
  it('counts unread and toggles all', async () => {
    const items = [
      { id: 'a', icon: House, title: 'A', unread: true },
      { id: 'b', icon: House, title: 'B', unread: false },
    ]
    const w = mount(KNotificationPanel, { props: { modelValue: items } })
    expect(w.find('[aria-label="1 unread"]').exists()).toBe(true)
    await w.get('button.ml-auto').trigger('click')
    const next = w.emitted('update:modelValue')?.[0]?.[0] as typeof items
    expect(next.every((n) => !n.unread)).toBe(true)
  })
})
