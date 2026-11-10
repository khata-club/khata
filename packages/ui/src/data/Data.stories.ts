import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Globe } from '@lucide/vue'
import { computed, ref } from 'vue'

import KButton from '../components/KButton.vue'
import KCodeBlock from './KCodeBlock.vue'
import KCopyField from './KCopyField.vue'
import KDataTable, { type DataTableSort } from './KDataTable.vue'
import KDateRangePicker from './KDateRangePicker.vue'
import KEmptyState from './KEmptyState.vue'
import KKeyValue from './KKeyValue.vue'
import KStatusPill from './KStatusPill.vue'
import KTimeline from './KTimeline.vue'

const meta = {
  title: 'Organisms/Data display',
} satisfies Meta

export default meta
type Story = StoryObj

const emails = [
  {
    id: 'em_01',
    to: 'priya@example.com',
    subject: 'Your login code',
    status: 'delivered',
    at: '12:04:11',
  },
  {
    id: 'em_02',
    to: 'sam@example.org',
    subject: 'Invoice #1042',
    status: 'bounced',
    at: '12:03:58',
  },
  {
    id: 'em_03',
    to: 'li@example.net',
    subject: 'Welcome to Acme',
    status: 'submitted',
    at: '12:03:40',
  },
  {
    id: 'em_04',
    to: 'ana@example.com',
    subject: 'Reset your password',
    status: 'submission_uncertain',
    at: '12:02:12',
  },
  {
    id: 'em_05',
    to: 'joe@example.com',
    subject: 'Weekly digest',
    status: 'complained',
    at: '11:58:01',
  },
]

export const Table: Story = {
  render: () => ({
    components: { KDataTable, KStatusPill },
    setup() {
      const sort = ref<DataTableSort>()
      const rows = computed(() => {
        if (!sort.value) return emails
        const { key, direction } = sort.value
        const k = key as keyof (typeof emails)[number]
        return [...emails].sort((a, b) => (a[k] < b[k] ? -1 : 1) * (direction === 'asc' ? 1 : -1))
      })
      const columns = [
        { key: 'to', label: 'To', sortable: true },
        { key: 'subject', label: 'Subject', class: 'max-md:hidden' },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'at', label: 'Time', align: 'right' },
      ]
      return { rows, sort, columns }
    },
    template: `
      <KDataTable v-model:sort="sort" :columns="columns" :rows="rows" row-key="id" caption="Recent emails" clickable has-next>
        <template #cell-status="{ value }"><KStatusPill :status="value" /></template>
      </KDataTable>`,
  }),
}

export const Details: Story = {
  render: () => ({
    components: {
      KKeyValue,
      KTimeline,
      KCopyField,
      KCodeBlock,
      KEmptyState,
      KButton,
      KDateRangePicker,
    },
    setup() {
      const range = ref({ from: '2026-10-30', to: '2026-11-05', preset: '7d' })
      return {
        range,
        Globe,
        code: `await dak.emails.send({\n  from: 'Acme <hello@acme.dev>',\n  to: 'priya@example.com',\n  subject: 'Your login code',\n  html: '<p>123456</p>',\n})`,
      }
    },
    template: `
      <div class="grid max-w-3xl gap-8">
        <KDateRangePicker v-model="range" today="2026-11-05" />
        <KKeyValue :items="[
          { key: 'id', label: 'Email ID', value: 'em_01JC3ZB1Q8', mono: true },
          { key: 'provider', label: 'SES message ID', value: '0100018f-7a1c-…', mono: true },
          { key: 'stream', label: 'Stream', value: 'authentication' },
          { key: 'template', label: 'Template', value: 'otp · v3' },
        ]" />
        <KTimeline label="Delivery trace" :items="[
          { id: 'a', title: 'Accepted', time: '12:04:11.020' },
          { id: 'b', title: 'Rendered', time: '12:04:11.034', duration: '14 ms' },
          { id: 'c', title: 'Submitted to SES', time: '12:04:11.210', duration: '176 ms', tone: 'primary' },
          { id: 'd', title: 'Delivered', time: '12:04:13.402', duration: '2.19 s', tone: 'success', description: '250 2.0.0 OK' },
        ]" />
        <KCopyField label="DKIM CNAME" value="abc123._domainkey.acme.dev" />
        <KCodeBlock title="Send an email" language="ts" :code="code" />
        <KEmptyState :icon="Globe" title="No domains yet" description="Add a domain to start sending from your own address.">
          <KButton size="sm">Add domain</KButton>
        </KEmptyState>
      </div>`,
  }),
}
