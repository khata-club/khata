import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import KAppShell from './KAppShell.vue'
import KBreadcrumbs from './KBreadcrumbs.vue'
import KSidebar from './KSidebar.vue'
import KSidebarSection from './KSidebarSection.vue'
import KTabs from './KTabs.vue'
import KToaster from './KToaster.vue'
import KTopbar from './KTopbar.vue'
import { useToast } from './useToast'

describe('KAppShell', () => {
  it('renders sidebar, topbar and main content', () => {
    const w = mount(KAppShell, {
      slots: { sidebar: '<p>side</p>', topbar: '<p>top</p>', default: '<p>body</p>' },
    })
    expect(w.get('aside').text()).toBe('side')
    expect(w.get('main').text()).toBe('body')
    expect(w.text()).toContain('top')
  })
})

describe('KSidebar', () => {
  it('labels the nav landmark and groups sections', () => {
    const w = mount({
      components: { KSidebar, KSidebarSection },
      template: `<KSidebar label="Main"><KSidebarSection title="Send"><a>Emails</a></KSidebarSection></KSidebar>`,
    })
    expect(w.get('nav').attributes('aria-label')).toBe('Main')
    const group = w.get('[role="group"]')
    expect(w.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('Send')
  })
})

describe('KTopbar', () => {
  it('emits menu from the mobile menu button', async () => {
    const w = mount(KTopbar, { props: { title: 'Domains' } })
    expect(w.get('h1').text()).toBe('Domains')
    await w.get('button[aria-label="Open navigation"]').trigger('click')
    expect(w.emitted('menu')).toHaveLength(1)
  })
})

describe('KBreadcrumbs', () => {
  it('links ancestors and marks the current page', () => {
    const w = mount(KBreadcrumbs, {
      props: { items: [{ label: 'Domains', href: '/domains' }, { label: 'example.com' }] },
    })
    expect(w.get('a').attributes('href')).toBe('/domains')
    expect(w.get('[aria-current="page"]').text()).toBe('example.com')
  })
})

describe('KTabs', () => {
  it('shows the first tab by default and counts', () => {
    const w = mount(KTabs, {
      props: {
        label: 'Email',
        items: [
          { value: 'timeline', label: 'Timeline', count: 7 },
          { value: 'content', label: 'Content' },
        ],
      },
      slots: { timeline: '<p>events</p>', content: '<p>html</p>' },
    })
    expect(w.get('[role="tablist"]').attributes('aria-label')).toBe('Email')
    expect(w.findAll('[role="tab"]')).toHaveLength(2)
    expect(w.get('[role="tab"][data-state="active"]').text()).toContain('7')
    expect(w.text()).toContain('events')
  })
})

describe('useToast / KToaster', () => {
  afterEach(() => useToast().clear())

  it('queues and dismisses toasts', async () => {
    const { toast, dismiss, toasts } = useToast()
    const id = toast({ title: 'Saved', tone: 'success' })
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]).toMatchObject({ title: 'Saved', tone: 'success', duration: 5000 })
    dismiss(id)
    expect(toasts.value).toHaveLength(0)
  })

  it('renders queued toasts', async () => {
    const w = mount(KToaster, { attachTo: document.body })
    useToast().toast({ title: 'Domain verified', description: 'example.com is ready' })
    await nextTick()
    await nextTick()
    expect(document.body.textContent).toContain('Domain verified')
    w.unmount()
  })
})
