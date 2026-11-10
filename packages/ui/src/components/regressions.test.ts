import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import KAlertDialog from './KAlertDialog.vue'
import KBottomNav from './KBottomNav.vue'
import KButton from './KButton.vue'
import KFormField from './KFormField.vue'
import KInput from './KInput.vue'
import KRadio from './KRadio.vue'
import KRadioGroup from './KRadioGroup.vue'
import KSearchInput from './KSearchInput.vue'
import KSwitch from './KSwitch.vue'
import KSwitchCard from './KSwitchCard.vue'
import KToggleButton from './KToggleButton.vue'

// Regression tests for bugs fixed in the UI review.

describe('KButton', () => {
  it('ignores activation while loading, including keyboard-triggered clicks', async () => {
    let clicks = 0
    const w = mount(KButton, {
      props: { loading: true, type: 'submit' },
      attrs: { onClick: () => clicks++ },
    })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    w.get('button').element.dispatchEvent(event)
    expect(clicks).toBe(0)
    expect(event.defaultPrevented).toBe(true) // so a form isn't submitted
    expect(w.get('button').attributes('aria-disabled')).toBe('true')
  })

  it('makes a disabled link inert: no navigation, out of the tab order, disabled styles', () => {
    const w = mount(KButton, { props: { as: 'a', disabled: true }, attrs: { href: '#x' } })
    const a = w.get('a')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    a.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(a.attributes('tabindex')).toBe('-1')
    expect(a.attributes('data-disabled')).toBe('')
    expect(a.attributes('disabled')).toBeUndefined()
  })
})

describe('KAlertDialog', () => {
  it('stays open on confirm while loading', async () => {
    const w = mount(KAlertDialog, {
      props: { title: 'Delete?', open: true, loading: true },
      attachTo: document.body,
    })
    await nextTick()
    const confirm = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Confirm'),
    )!
    confirm.click()
    await nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.emitted('confirm')).toBeUndefined()
    w.unmount()
  })

  it('emits confirm without closing itself', async () => {
    const w = mount(KAlertDialog, {
      props: { title: 'Delete?', open: true },
      attachTo: document.body,
    })
    await nextTick()
    const confirm = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Confirm'),
    )!
    confirm.click()
    await nextTick()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('update:open')).toBeUndefined()
    w.unmount()
  })
})

describe('KSwitch', () => {
  const track = (w: ReturnType<typeof mount>) => w.get('[data-slot="switch-track"]')
  const thumb = (w: ReturnType<typeof mount>) => w.get('[data-slot="switch-track"] > *')

  it('draws off as a clean outlined well with a grey dot (no smeared recessed shadow)', () => {
    const w = mount(KSwitch, { props: { modelValue: false } })
    expect(track(w).classes()).toEqual(
      expect.arrayContaining(['border-line-control', 'bg-surface', 'shadow-recessed']),
    )
    expect(track(w).classes()).not.toContain('bg-gray-450')
    expect(thumb(w).classes()).toEqual(expect.arrayContaining(['bg-line-control', 'scale-75']))
  })

  it('draws disabled-off with a dashed outline and a visible grey thumb', () => {
    const w = mount(KSwitch, { props: { modelValue: false, disabled: true } })
    expect(track(w).classes()).toEqual(
      expect.arrayContaining(['border-dashed', 'bg-surface-recessed']),
    )
    expect(thumb(w).classes()).toContain('bg-control-disabled-mark')
  })

  it('lets disabled win over checked, and checked over invalid', () => {
    const disabledOn = mount(KSwitch, {
      props: { modelValue: true, disabled: true, invalid: true },
    })
    expect(track(disabledOn).classes()).toContain('bg-control-disabled')
    const invalidOn = mount(KSwitch, { props: { modelValue: true, invalid: true } })
    expect(track(invalidOn).classes()).toContain('bg-primary')
  })
})

describe('KSwitchCard', () => {
  it('names the switch by its title and describes it with the description', () => {
    const w = mount(KSwitchCard, {
      props: { title: 'Updates', description: 'A short email', name: 'updates' },
    })
    const sw = w.get('[role="switch"]')
    const titleId = sw.attributes('aria-labelledby')!
    const descId = sw.attributes('aria-describedby')!
    expect(w.get(`[id="${titleId}"]`).text()).toBe('Updates')
    expect(w.get(`[id="${descId}"]`).text()).toBe('A short email')
  })
})

describe('KRadioGroup', () => {
  it('puts aria-invalid on the radiogroup, not on each radio', () => {
    const w = mount({
      components: { KRadioGroup, KRadio },
      template: `<KRadioGroup label="Plan" invalid required><KRadio value="a">A</KRadio></KRadioGroup>`,
    })
    const group = w.get('[role="radiogroup"]')
    expect(group.attributes('aria-invalid')).toBe('true')
    expect(group.attributes('aria-label')).toBe('Plan')
    expect(w.get('[role="radio"]').attributes('aria-invalid')).toBeUndefined()
  })
})

describe('KFormField', () => {
  it('falls back to the hint when the error is an empty string', () => {
    const w = mount({
      components: { KFormField, KInput },
      template: `<KFormField label="Email" id="e" hint="For receipts" error=""><template #default="{ field }"><KInput v-bind="field" /></template></KFormField>`,
    })
    expect(w.get('#e-message').text()).toBe('For receipts')
    expect(w.get('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('keeps the live region mounted before any message, so the first error is announced', () => {
    const w = mount({
      components: { KFormField, KInput },
      template: `<KFormField label="Email" id="e"><template #default="{ field }"><KInput v-bind="field" /></template></KFormField>`,
    })
    const region = w.get('#e-message')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')
    expect(w.get('input').attributes('aria-describedby')).toBeUndefined()
  })
})

describe('KToggleButton', () => {
  it('has an accessible name and only pops on user toggles', async () => {
    const w = mount(KToggleButton, { props: { label: 'Favourite', modelValue: false } })
    const button = w.get('button')
    expect(button.attributes('aria-label')).toBe('Favourite')
    await w.setProps({ modelValue: true })
    expect(button.classes()).not.toContain('scale-[1.12]')
    await button.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(button.classes()).toContain('scale-[1.12]')
  })
})

describe('KBottomNav', () => {
  it('marks nothing current when the value matches no item', () => {
    const icon = { render: () => null }
    const w = mount(KBottomNav, {
      props: {
        modelValue: 'missing',
        items: [
          { value: 'a', label: 'A', icon },
          { value: 'b', label: 'B', icon },
        ],
      },
    })
    expect(w.findAll('[aria-current]')).toHaveLength(0)
  })
})

describe('KSearchInput', () => {
  it('forwards attributes to the input and keeps focus there after clearing', async () => {
    const w = mount(KSearchInput, {
      props: { modelValue: 'rent' },
      attrs: { id: 'q', name: 'q' },
      attachTo: document.body,
    })
    const input = w.get('input')
    expect(input.attributes('id')).toBe('q')
    expect(w.get('[role="search"]').attributes('id')).toBeUndefined()
    await w.get('button[aria-label="Clear search"]').trigger('click')
    expect(document.activeElement).toBe(input.element)
    w.unmount()
  })

  it('does not submit while an IME composition is being confirmed', async () => {
    const w = mount(KSearchInput, { props: { modelValue: 'とうきょう' } })
    await w.get('input').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(w.emitted('submit')).toBeUndefined()
    await w.get('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')?.[0]).toEqual(['とうきょう'])
  })
})
