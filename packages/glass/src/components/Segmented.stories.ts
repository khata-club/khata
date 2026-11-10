import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ChartPie, List, Users } from '@lucide/vue'
import { ref } from 'vue'

import GSegmentedControl from './GSegmentedControl.vue'
import GSegmentedTabs from './GSegmentedTabs.vue'

const meta = { title: 'Molecules/Segmented' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const ranges = ['1W', '1M', '3M', '6M', '1Y', 'All'].map((r) => ({ value: r, label: r }))

export const Control: Story = {
  render: () => ({
    components: { GSegmentedControl },
    setup: () => ({ a: ref('1M'), b: ref('list'), ranges }),
    template: `
      <div class="flex flex-col items-start gap-6">
        <GSegmentedControl v-model="a" :options="ranges" label="Range" />
        <GSegmentedControl v-model="b" size="sm" label="View" :options="[{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }]" />
        <p class="m-0 text-subhead text-label-secondary">The thumb springs between segments and swells a touch while it travels.</p>
      </div>`,
  }),
}

export const OverContent: Story = {
  name: 'Over content',
  parameters: { backdrop: 'Wallpaper' },
  render: () => ({
    components: { GSegmentedControl },
    setup: () => ({ a: ref('1Y'), ranges }),
    template: `<GSegmentedControl v-model="a" :options="ranges" label="Range" variant="glass" />`,
  }),
}

export const Tabs: Story = {
  render: () => ({
    components: { GSegmentedTabs },
    setup: () => ({
      items: [
        { value: 'ledger', label: 'Ledger', icon: List },
        { value: 'members', label: 'Members', icon: Users },
        { value: 'summary', label: 'Summary', icon: ChartPie },
      ],
    }),
    template: `
      <GSegmentedTabs :items="items" label="Khata sections">
        <template #ledger><div class="rounded-xl bg-surface p-5 text-subhead">12 entries this month.</div></template>
        <template #members><div class="rounded-xl bg-surface p-5 text-subhead">Five people share this khata.</div></template>
        <template #summary><div class="rounded-xl bg-surface p-5 text-subhead">You are owed ₹2,340.</div></template>
      </GSegmentedTabs>`,
  }),
}
