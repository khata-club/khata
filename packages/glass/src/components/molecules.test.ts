import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { House, Search } from '@lucide/vue'
import { nextTick } from 'vue'

import GTabBar from './GTabBar.vue'
import GFormField from './GFormField.vue'
import GInput from './GInput.vue'
import GNavItem from './GNavItem.vue'
import GNotificationPanel from './GNotificationPanel.vue'
import GProgress from './GProgress.vue'
import GSearchInput from './GSearchInput.vue'
import GAlert from './GAlert.vue'
import GListRow from './GListRow.vue'
import GListSection from './GListSection.vue'
import GSegmentedControl from './GSegmentedControl.vue'
import GSwitchRow from './GSwitchRow.vue'

const fieldWith = (props: Record<string, unknown>) =>
  mount({
    components: { GFormField, GInput },
    data: () => ({ props }),
    template: `<GFormField v-bind="props"><template #default="{ field }"><GInput v-bind="field" /></template></GFormField>`,
  })

describe('GFormField', () => {
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
    expect(w.get('#e-message').classes()).toContain('text-negative')
  })
})

describe('GSearchInput', () => {
  it('uses a plain text input (no native clear button) and clears on click', async () => {
    const w = mount(GSearchInput, { props: { modelValue: 'rent' } })
    const input = w.get('input')
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('inputmode')).toBe('search')
    await w.get('button[aria-label="Clear search"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([''])
  })
})

describe('GProgress', () => {
  it('reports value and indeterminate state through ARIA', async () => {
    const w = mount(GProgress, { props: { value: 40, label: 'Upload' } })
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    await w.setProps({ value: null })
    await nextTick()
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
  })
})

describe('navigation', () => {
  it('GNavItem marks the current page', () => {
    const w = mount(GNavItem, { props: { icon: House, current: true }, slots: { default: 'Home' } })
    expect(w.attributes('aria-current')).toBe('page')
  })

  it('GTabBar moves aria-current on click', async () => {
    const items = [
      { value: 'home', label: 'Home', icon: House },
      { value: 'search', label: 'Search', icon: Search },
    ]
    const w = mount(GTabBar, { props: { items, modelValue: 'home' } })
    await w.findAll('button')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['search'])
  })
})

describe('GNotificationPanel', () => {
  it('counts unread and toggles all', async () => {
    const items = [
      { id: 'a', icon: House, title: 'A', unread: true },
      { id: 'b', icon: House, title: 'B', unread: false },
    ]
    const w = mount(GNotificationPanel, { props: { modelValue: items } })
    expect(w.find('[aria-label="1 unread"]').exists()).toBe(true)
    await w.get('button.ml-auto').trigger('click')
    const next = w.emitted('update:modelValue')?.[0]?.[0] as typeof items
    expect(next.every((n) => !n.unread)).toBe(true)
  })
})

describe('GSegmentedControl', () => {
  it('is a radio group with a sliding thumb', async () => {
    const w = mount(GSegmentedControl, {
      props: {
        label: 'Range',
        modelValue: 'a',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
      attachTo: document.body,
    })
    expect(w.get('[role="radiogroup"]').attributes('aria-label')).toBe('Range')
    expect(w.find('span[aria-hidden="true"]').exists()).toBe(true)
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
    w.unmount()
  })
})

describe('GListSection', () => {
  it('renders header, rows and footer as a list', () => {
    const w = mount({
      components: { GListSection, GListRow },
      template: `<GListSection header="Account" footer="Shown to members"><GListRow title="Members" value="5" chevron /></GListSection>`,
    })
    expect(w.get('h3').text()).toBe('Account')
    expect(w.get('[role="list"] [role="listitem"]').text()).toContain('Members')
    expect(w.text()).toContain('Shown to members')
  })
})

describe('GSwitchRow', () => {
  it('makes the whole row a labelled switch', async () => {
    const w = mount(GSwitchRow, { props: { title: 'Reminders', modelValue: false } })
    const s = w.get('[role="switch"]')
    expect(s.text()).toContain('Reminders')
    await s.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})

describe('GAlert', () => {
  it('uses alert semantics for warnings and dismisses', async () => {
    const w = mount(GAlert, { props: { tone: 'warning', title: 'Due soon' } })
    expect(w.find('[role="alert"]').exists()).toBe(true)
    await w.get('button[aria-label="Dismiss"]').trigger('click')
    expect(w.emitted('update:open')?.[0]).toEqual([false])
  })
})
