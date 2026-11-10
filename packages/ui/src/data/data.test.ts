import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { Inbox } from '@lucide/vue'

import KCopyField from './KCopyField.vue'
import KDataTable from './KDataTable.vue'
import KDateRangePicker from './KDateRangePicker.vue'
import KEmptyState from './KEmptyState.vue'
import KKeyValue from './KKeyValue.vue'
import KStatusPill from './KStatusPill.vue'
import KTimeline from './KTimeline.vue'
import { presetRange } from './dateRange'

const rows = [
  { id: 'em_1', to: 'a@example.com', status: 'delivered', size: 12 },
  { id: 'em_2', to: 'b@example.com', status: 'bounced', size: 7 },
]
const columns = [
  { key: 'to' as const, label: 'To', sortable: true },
  { key: 'status' as const, label: 'Status' },
  { key: 'size' as const, label: 'KB', align: 'right' as const },
]

describe('KDataTable', () => {
  it('renders a captioned table with rows and custom cells', () => {
    const w = mount(KDataTable, {
      props: { columns, rows, rowKey: 'id', caption: 'Emails' },
      slots: { 'cell-status': '<template #cell-status="{ value }"><b>{{ value }}</b></template>' },
    })
    expect(w.get('caption').text()).toBe('Emails')
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.get('tbody b').text()).toBe('delivered')
  })

  it('cycles sort and reports aria-sort', async () => {
    const w = mount(KDataTable, {
      props: { columns, rows, rowKey: 'id', caption: 'Emails', sort: undefined },
    })
    await w.get('th button').trigger('click')
    expect(w.emitted('update:sort')![0]).toEqual([{ key: 'to', direction: 'asc' }])
    await w.setProps({ sort: { key: 'to', direction: 'asc' } })
    expect(w.get('th').attributes('aria-sort')).toBe('ascending')
    await w.get('th button').trigger('click')
    expect(w.emitted('update:sort')![1]).toEqual([{ key: 'to', direction: 'desc' }])
  })

  it('emits row-click by mouse and keyboard when clickable', async () => {
    const w = mount(KDataTable, {
      props: { columns, rows, rowKey: 'id', caption: 'Emails', clickable: true },
    })
    await w.get('tbody tr').trigger('click')
    await w.findAll('tbody tr')[1]!.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('row-click')).toEqual([[rows[0]], [rows[1]]])
  })

  it('shows the empty slot and cursor pager', async () => {
    const w = mount(KDataTable, {
      props: { columns, rows: [], rowKey: 'id', caption: 'Emails', hasNext: true },
      slots: { empty: '<p>No emails</p>' },
    })
    expect(w.text()).toContain('No emails')
    expect(w.get('[aria-label="Previous page"]').attributes('disabled')).toBeDefined()
    await w.get('[aria-label="Next page"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
  })
})

describe('KStatusPill', () => {
  it('humanises status and maps tone', () => {
    const w = mount(KStatusPill, { props: { status: 'submission_uncertain' } })
    expect(w.text()).toBe('Submission uncertain')
    expect(w.classes().join(' ')).toContain('text-warning')
  })
})

describe('KCopyField', () => {
  it('copies its value to the clipboard', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    const w = mount(KCopyField, {
      props: { value: 'v=spf1 include:amazonses.com ~all', label: 'SPF' },
    })
    expect(w.get('label').attributes('for')).toBe(w.get('input').attributes('id'))
    await w.get('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith('v=spf1 include:amazonses.com ~all')
  })
})

describe('KKeyValue / KTimeline / KEmptyState', () => {
  it('renders definition pairs', () => {
    const w = mount(KKeyValue, {
      props: {
        items: [
          { key: 'id', label: 'Email ID', value: 'em_1', mono: true },
          { key: 'x', label: 'Tag' },
        ],
      },
    })
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['Email ID', 'Tag'])
    expect(w.findAll('dd')[1]!.text()).toBe('—')
  })

  it('renders an ordered timeline', () => {
    const w = mount(KTimeline, {
      props: {
        label: 'Trace',
        items: [
          { id: 'a', title: 'Accepted', time: '12:00:00.000' },
          { id: 'b', title: 'Delivered', tone: 'success', duration: '2.1 s' },
        ],
      },
    })
    expect(w.get('ol').attributes('aria-label')).toBe('Trace')
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.text()).toContain('+2.1 s')
  })

  it('renders empty states with actions', () => {
    const w = mount(KEmptyState, {
      props: { title: 'No domains yet', icon: Inbox },
      slots: { default: '<button>Add domain</button>' },
    })
    expect(w.text()).toContain('No domains yet')
    expect(w.get('button').text()).toBe('Add domain')
  })
})

describe('KDateRangePicker', () => {
  it('computes inclusive preset ranges', () => {
    expect(presetRange(7, '2026-11-05')).toEqual({ from: '2026-10-30', to: '2026-11-05' })
    expect(presetRange(1, '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-05' })
  })

  it('shows date inputs for custom ranges and keeps from ≤ to', async () => {
    const w = mount(KDateRangePicker, {
      props: { modelValue: { from: '2026-11-01', to: '2026-11-05', preset: 'custom' } },
    })
    const [from] = w.findAll('input[type="date"]')
    await from!.setValue('2026-11-09')
    await from!.trigger('change')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([
      { from: '2026-11-09', to: '2026-11-09', preset: 'custom' },
    ])
  })
})
