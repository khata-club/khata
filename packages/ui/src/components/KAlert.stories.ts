import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { reactive } from 'vue'

import KAlert from './KAlert.vue'
import KButton from './KButton.vue'

const meta = {
  title: 'Molecules/Alert banner',
  component: KAlert,
  argTypes: { tone: { control: 'select', options: ['primary', 'success', 'warning', 'danger'] } },
  args: { tone: 'primary', title: 'All set!', dismissible: true },
} satisfies Meta<typeof KAlert>

export default meta
type Story = StoryObj<typeof meta>

/** Dismissed banners collapse smoothly; "Show all" brings them back. */
export const AllTones: Story = {
  render: () => ({
    components: { KAlert, KButton },
    setup() {
      const open = reactive({ a1: true, a2: true, a3: true, a4: true })
      const all = () => Object.keys(open).forEach((k) => (open[k as keyof typeof open] = true))
      return { open, all }
    },
    template: `
      <div class="flex flex-col gap-4">
        <div><KButton size="sm" variant="ghost" @click="all">Show all</KButton></div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-4">
          <KAlert v-model:open="open.a1" tone="primary" title="All set!">Your changes have been saved.</KAlert>
          <KAlert v-model:open="open.a2" tone="success" title="Backup complete">All 1,284 files are stored safely.</KAlert>
          <KAlert v-model:open="open.a3" tone="warning" title="Storage almost full">You have used 4.6 GB of your 5 GB plan.</KAlert>
          <KAlert v-model:open="open.a4" tone="danger" title="Payment failed">Update your card to keep your plan active.</KAlert>
        </div>
      </div>`,
  }),
}
