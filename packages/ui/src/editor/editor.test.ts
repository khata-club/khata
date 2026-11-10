import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import KColorField from './KColorField.vue'
import KKbd from './KKbd.vue'
import KNumberField from './KNumberField.vue'
import KSlider from './KSlider.vue'

describe('KNumberField', () => {
  it('shows the value at the given precision with a suffix', () => {
    const w = mount(KNumberField, {
      props: { modelValue: 1.23456, precision: 2, suffix: '%', label: 'S' },
    })
    expect((w.get('input').element as HTMLInputElement).value).toBe('1.23')
    expect(w.text()).toContain('%')
  })

  it('commits a typed value clamped to range', async () => {
    const w = mount(KNumberField, { props: { modelValue: 5, min: 0, max: 10 } })
    const input = w.get('input')
    await input.trigger('focus')
    await input.setValue('42')
    await input.trigger('blur')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([10])
    expect(w.emitted('commit')?.at(-1)).toEqual([10])
  })

  it('ignores invalid text', async () => {
    const w = mount(KNumberField, { props: { modelValue: 5 } })
    const input = w.get('input')
    await input.trigger('focus')
    await input.setValue('abc')
    await input.trigger('blur')
    expect(w.emitted('commit')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('5')
  })

  it('steps with the arrow keys (shift = ×10)', async () => {
    const w = mount(KNumberField, { props: { modelValue: 1, step: 1 } })
    await w.get('input').trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([11])
  })

  it('does not commit or round when focused and left without typing', async () => {
    const w = mount(KNumberField, { props: { modelValue: 1.23456, precision: 2 } })
    const input = w.get('input')
    await input.trigger('focus')
    await input.trigger('blur')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('commit')).toBeUndefined()
  })

  it('discards typed text on Escape', async () => {
    const w = mount(KNumberField, { props: { modelValue: 5 } })
    const input = w.get('input')
    await input.trigger('focus')
    await input.setValue('9')
    await input.trigger('keydown', { key: 'Escape' })
    await input.trigger('blur')
    expect(w.emitted('commit')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('5')
  })

  it('steps from the typed value, not the stale model', async () => {
    const w = mount(KNumberField, { props: { modelValue: 5 } })
    const input = w.get('input')
    await input.trigger('focus')
    await input.setValue('20')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([21])
  })

  it('is a named spinbutton, also without a visible label', () => {
    const w = mount(KNumberField, {
      props: { modelValue: 3, min: 0, max: 10, suffix: 'dB' },
      attrs: { 'aria-label': 'Gain' },
    })
    const input = w.get('input')
    expect(input.attributes('role')).toBe('spinbutton')
    expect(input.attributes('aria-label')).toBe('Gain')
    expect(input.attributes('aria-valuenow')).toBe('3')
    expect(input.attributes('aria-valuetext')).toBe('3 dB')
    expect(w.get('[data-slot="number-field"]').attributes('aria-label')).toBeUndefined()
  })
})

describe('KColorField', () => {
  it('normalises typed hex and rejects junk', async () => {
    const w = mount(KColorField, { props: { modelValue: '#000000' } })
    const text = w.findAll('input')[1]!
    await text.setValue('fa0')
    await text.trigger('blur')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['#FFAA00'])
    await text.setValue('nope')
    await text.trigger('blur')
    expect(w.emitted('commit')).toHaveLength(1)
  })

  it('emits the same #RRGGBB case from the picker and shows short hex in it', async () => {
    const w = mount(KColorField, { props: { modelValue: '#abc' } })
    const picker = w.get('input[type="color"]')
    expect((picker.element as HTMLInputElement).value).toBe('#aabbcc')
    await picker.setValue('#ff8800')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['#FF8800'])
  })
})

describe('KSlider', () => {
  // jsdom has no ResizeObserver; Reka's slider measures its thumb with one.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

  it('renders an accessible slider thumb with the value', async () => {
    const w = mount(KSlider, { props: { modelValue: 30, min: 0, max: 100, label: 'Opacity' } })
    // Reka registers the thumb with the root after mount.
    await nextTick()
    const thumb = w.get('[role="slider"]')
    expect(thumb.attributes('aria-label')).toBe('Opacity')
    expect(thumb.attributes('aria-valuenow')).toBe('30')
  })
})

describe('KKbd', () => {
  it('renders a kbd element', () => {
    expect(
      mount(KKbd, { slots: { default: 'K' } })
        .get('kbd')
        .text(),
    ).toBe('K')
  })
})
