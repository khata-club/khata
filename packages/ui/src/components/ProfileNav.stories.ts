import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { House, Inbox, LayoutGrid, Settings } from '@lucide/vue'
import { ref } from 'vue'

import KNavItem from './KNavItem.vue'
import KProfileSummary from './KProfileSummary.vue'

const meta = { title: 'Molecules/Profile summary & nav item' } satisfies Meta
export default meta

export const Default: StoryObj<typeof meta> = {
  name: 'Profile summary & nav item',
  render: () => ({
    components: { KProfileSummary, KNavItem },
    setup: () => ({
      current: ref(0),
      items: [
        { icon: House, label: 'Home' },
        { icon: LayoutGrid, label: 'Projects' },
        { icon: Inbox, label: 'Inbox', badge: 3 },
        { icon: Settings, label: 'Settings' },
      ],
    }),
    template: `
      <div class="flex max-w-md flex-col gap-6">
        <div class="flex flex-wrap gap-6">
          <KProfileSummary name="Olivia Bennett" subtitle="Product Designer" initials="OB" class="flex-[1_1_200px]" />
          <KProfileSummary name="Marco Kim" subtitle="Engineer · Lisbon" initials="MK" size="sm" class="flex-[1_1_160px]" />
        </div>
        <nav aria-label="Workspace" class="flex flex-col gap-1">
          <KNavItem v-for="(n, i) in items" :key="n.label" :icon="n.icon" :badge="n.badge" :current="i === current" @click="current = i">{{ n.label }}</KNavItem>
        </nav>
      </div>`,
  }),
}
