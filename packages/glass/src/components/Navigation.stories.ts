import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ChartPie, House, Inbox, Plus, Search, Settings, Users } from '@lucide/vue'
import { ref } from 'vue'

import GButton from './GButton.vue'
import GNavBar from './GNavBar.vue'
import GNavItem from './GNavItem.vue'
import GTabBar from './GTabBar.vue'

const meta = { title: 'Molecules/Navigation' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const tabs = [
  { value: 'home', label: 'Home', icon: House },
  { value: 'groups', label: 'Groups', icon: Users },
  { value: 'insights', label: 'Insights', icon: ChartPie },
  { value: 'search', label: 'Search', icon: Search },
]

export const TabBar: Story = {
  parameters: { backdrop: 'Content' },
  render: () => ({
    components: { GTabBar },
    setup: () => ({ v: ref('home'), tabs }),
    template: `
      <div class="flex flex-col items-center gap-6 pt-10">
        <GTabBar v-model="v" :items="tabs" />
        <span class="text-subhead text-label-secondary">Selected: {{ v }}</span>
      </div>`,
  }),
}

export const Page: Story = {
  name: 'Nav bar & tab bar',
  parameters: { backdrop: 'Plain' },
  render: () => ({
    components: { GNavBar, GTabBar, GButton, Plus },
    setup: () => ({ v: ref('home'), tabs, rows: Array.from({ length: 24 }, (_, i) => i + 1) }),
    template: `
      <div class="-m-8 min-h-[200vh]">
        <GNavBar title="Khatas">
          <template #leading><GButton variant="plain" size="sm">Edit</GButton></template>
          <template #trailing><GButton variant="glass" size="sm" icon-only aria-label="New khata"><Plus /></GButton></template>
          <div class="flex flex-col gap-2 px-4 pb-32">
            <div v-for="r in rows" :key="r" class="flex items-center justify-between rounded-xl bg-surface px-4 py-3.5">
              <span class="text-body">Khata {{ r }}</span>
              <span class="text-body text-label-secondary tabular-nums">₹{{ (r * 1375).toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </GNavBar>
        <div class="fixed inset-x-0 bottom-6 flex justify-center">
          <GTabBar v-model="v" :items="tabs" minimize-on-scroll />
        </div>
      </div>`,
  }),
}

export const Sidebar: Story = {
  render: () => ({
    components: { GNavItem },
    setup: () => ({ House, Inbox, Users, Settings }),
    template: `
      <nav aria-label="Sidebar" class="flex w-[260px] flex-col gap-0.5 rounded-xl bg-surface p-2">
        <GNavItem :icon="House" current>Home</GNavItem>
        <GNavItem :icon="Inbox" badge="3">Requests</GNavItem>
        <GNavItem :icon="Users">Groups</GNavItem>
        <GNavItem :icon="Settings">Settings</GNavItem>
      </nav>`,
  }),
}
