import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import GBadge from './GBadge.vue'
import GButton from './GButton.vue'
import GCheckbox from './GCheckbox.vue'
import GInput from './GInput.vue'
import GLabel from './GLabel.vue'
import GRadio from './GRadio.vue'
import GRadioGroup from './GRadioGroup.vue'
import GSlider from './GSlider.vue'
import GSwitch from './GSwitch.vue'
import GToggleButton from './GToggleButton.vue'

describe('GButton', () => {
  it('renders a typed button in tinted glass by default', () => {
    const w = mount(GButton, { slots: { default: 'Continue' } })
    const b = w.get('button')
    expect(b.attributes('type')).toBe('button')
    expect(b.classes()).toContain('glass-tinted')
    expect(b.text()).toBe('Continue')
  })

  it('springs: presses fast, releases on the bouncy curve', () => {
    const b = mount(GButton).get('button')
    expect(b.classes()).toContain('ease-bouncy')
    expect(b.classes()).toContain('active:scale-[0.96]')
  })

  it('marks loading as busy, keeps the label for width and shows a spinner', () => {
    const w = mount(GButton, { props: { loading: true }, slots: { default: 'Save' } })
    expect(w.get('button').attributes('aria-busy')).toBe('true')
    expect(w.find('[data-slot="spinner"]').exists()).toBe(true)
    expect(w.text()).toBe('Save')
  })

  it('renders as a link without a type or native disabled attribute', () => {
    const w = mount(GButton, { props: { as: 'a', disabled: true }, attrs: { href: '#x' } })
    const a = w.get('a')
    expect(a.attributes('type')).toBeUndefined()
    expect(a.attributes('aria-disabled')).toBe('true')
  })
})

describe('GSwitch', () => {
  it('toggles aria-checked and emits the model update', async () => {
    const w = mount(GSwitch, { props: { modelValue: false }, slots: { default: 'Wi-Fi' } })
    const s = w.get('[role="switch"]')
    expect(s.attributes('aria-checked')).toBe('false')
    await s.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(s.text()).toBe('Wi-Fi')
  })

  it('does not toggle when disabled', async () => {
    const w = mount(GSwitch, { props: { modelValue: true, disabled: true } })
    await w.get('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('GCheckbox', () => {
  it('announces the indeterminate state as mixed', () => {
    const w = mount(GCheckbox, { props: { modelValue: 'indeterminate' } })
    expect(w.get('[role="checkbox"]').attributes('aria-checked')).toBe('mixed')
  })

  it('checks on click', async () => {
    const w = mount(GCheckbox, { props: { modelValue: false } })
    await w.get('[role="checkbox"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})

describe('GRadioGroup', () => {
  it('selects one value', async () => {
    const w = mount(GRadioGroup, {
      props: { modelValue: 'a' },
      slots: {
        default: () => [mountRadio('a'), mountRadio('b')],
      },
    })
    const radios = w.findAll('[role="radio"]')
    expect(radios[0]!.attributes('aria-checked')).toBe('true')
    await radios[1]!.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })
})

function mountRadio(value: string) {
  return h(GRadio, { value }, () => value)
}

describe('GToggleButton', () => {
  it('reflects the pressed state', async () => {
    const w = mount(GToggleButton, { props: { modelValue: false } })
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})

describe('GInput', () => {
  it('binds the model and flags invalid', async () => {
    const w = mount(GInput, { props: { modelValue: 'a', invalid: true } })
    const i = w.get('input')
    expect(i.attributes('aria-invalid')).toBe('true')
    await i.setValue('ab')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['ab'])
  })
})

describe('GLabel', () => {
  it('shows required or optional', () => {
    expect(mount(GLabel, { props: { required: true } }).text()).toContain('*')
    expect(mount(GLabel, { props: { optional: true } }).text()).toContain('Optional')
  })
})

describe('GBadge', () => {
  it('applies the tone', () => {
    expect(mount(GBadge, { props: { tone: 'positive' } }).classes()).toContain('text-positive')
  })
})

describe('GSlider', () => {
  it('exposes a labelled slider thumb with the value', async () => {
    const w = mount(GSlider, { props: { modelValue: 40, label: 'Volume' } })
    await nextTick()
    const t = w.get('[role="slider"]')
    expect(t.attributes('aria-label')).toBe('Volume')
    expect(t.attributes('aria-valuenow')).toBe('40')
  })
})
