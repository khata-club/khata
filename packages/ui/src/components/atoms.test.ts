import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import KBadge from './KBadge.vue'
import KButton from './KButton.vue'
import KCheckbox from './KCheckbox.vue'
import KInput from './KInput.vue'
import KLabel from './KLabel.vue'
import KRadio from './KRadio.vue'
import KRadioGroup from './KRadioGroup.vue'
import KSwitch from './KSwitch.vue'

describe('KButton', () => {
  it('renders a typed button with variant classes', () => {
    const w = mount(KButton, { props: { variant: 'danger' }, slots: { default: 'Delete' } })
    const b = w.get('button')
    expect(b.attributes('type')).toBe('button')
    expect(b.classes()).toContain('bg-danger')
    expect(b.text()).toBe('Delete')
  })

  it('marks loading as busy and shows a spinner', () => {
    const w = mount(KButton, { props: { loading: true }, slots: { default: 'Saving…' } })
    expect(w.get('button').attributes('aria-busy')).toBe('true')
    expect(w.find('[aria-hidden="true"].animate-ck-spin').exists()).toBe(true)
  })

  it('renders as a link without a type or native disabled attribute', () => {
    const w = mount(KButton, { props: { as: 'a', disabled: true }, attrs: { href: '#x' } })
    const a = w.get('a')
    expect(a.attributes('type')).toBeUndefined()
    expect(a.attributes('aria-disabled')).toBe('true')
  })
})

describe('KSwitch', () => {
  it('toggles aria-checked and emits the model update', async () => {
    const w = mount(KSwitch, { props: { modelValue: false }, slots: { default: 'Wi-Fi' } })
    const s = w.get('[role="switch"]')
    expect(s.attributes('aria-checked')).toBe('false')
    await s.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(s.text()).toBe('Wi-Fi')
  })

  it('does not toggle when disabled', async () => {
    const w = mount(KSwitch, { props: { modelValue: true, disabled: true } })
    await w.get('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('KCheckbox', () => {
  it('announces the indeterminate state as mixed', () => {
    const w = mount(KCheckbox, { props: { modelValue: 'indeterminate' } })
    expect(w.get('[role="checkbox"]').attributes('aria-checked')).toBe('mixed')
  })

  it('checks on click', async () => {
    const w = mount(KCheckbox, { props: { modelValue: false } })
    await w.get('[role="checkbox"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})

describe('KRadioGroup', () => {
  it('selects one value and exposes radio semantics', async () => {
    const w = mount({
      components: { KRadioGroup, KRadio },
      data: () => ({ v: 'a' }),
      template: `<KRadioGroup v-model="v" aria-label="Pick"><KRadio value="a">A</KRadio><KRadio value="b">B</KRadio></KRadioGroup>`,
    })
    expect(w.find('[role="radiogroup"]').exists()).toBe(true)
    const radios = w.findAll('[role="radio"]')
    expect(radios[0]!.attributes('aria-checked')).toBe('true')
    await radios[1]!.trigger('click')
    await nextTick()
    expect((w.vm as unknown as { v: string }).v).toBe('b')
  })
})

describe('KInput', () => {
  it('binds v-model and flags invalid', async () => {
    const w = mount(KInput, { props: { modelValue: 'a', invalid: true } })
    const input = w.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    await input.setValue('abc')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['abc'])
  })
})

describe('KLabel / KBadge', () => {
  it('hides the required asterisk from assistive tech', () => {
    const w = mount(KLabel, { props: { required: true }, slots: { default: 'Email' } })
    expect(w.get('[aria-hidden="true"]').text()).toBe('*')
  })

  it('renders badge tone classes', () => {
    const w = mount(KBadge, { props: { tone: 'success' }, slots: { default: 'Paid' } })
    expect(w.classes()).toContain('text-success')
  })
})
