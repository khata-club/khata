import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { useSlidingIndicator } from './useSlidingIndicator'
import { useTheme } from './useTheme'

describe('useSlidingIndicator', () => {
  it('hides until an item is active, then follows it', async () => {
    const active = ref<number | null>(null)
    const Host = defineComponent({
      setup() {
        const root = ref<HTMLElement>()
        const { style, visible } = useSlidingIndicator(root, '[data-state=on]')
        return () =>
          h('div', { ref: root }, [
            h('span', { class: 'ind', style: style.value, 'data-visible': String(visible.value) }),
            ...[0, 1].map((i) => h('button', { 'data-state': active.value === i ? 'on' : 'off' })),
          ])
      },
    })
    const w = mount(Host, { attachTo: document.body })
    expect(w.find('.ind').attributes('data-visible')).toBe('false')
    active.value = 1
    await nextTick()
    await new Promise((r) => setTimeout(r)) // MutationObserver
    expect(w.find('.ind').attributes('data-visible')).toBe('true')
    expect(w.find('.ind').attributes('style')).toContain('translate(')
    w.unmount()
  })
})

describe('useTheme', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'))

  it('pins data-theme on <html> and clears it for system', async () => {
    let api!: ReturnType<typeof useTheme>
    const w = mount(defineComponent({ setup: () => ((api = useTheme()), () => null) }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    api.preference.value = 'dark'
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(api.isDark.value).toBe(true)
    api.preference.value = 'system'
    await nextTick()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    w.unmount()
  })
})
