import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Calendar, Download, Users } from '@lucide/vue'
import { ref } from 'vue'

import KNotificationPanel, { type Notification } from './KNotificationPanel.vue'

const seed = (): Notification[] => [
  {
    id: 'n1',
    icon: Calendar,
    tone: 'primary',
    title: 'Design review scheduled',
    body: 'Tomorrow at 10:00 with the Platform team.',
    time: '2m ago',
    unread: true,
  },
  {
    id: 'n2',
    icon: Download,
    tone: 'success',
    title: 'Export finished',
    body: 'brand-assets.zip is ready to download.',
    time: '1h ago',
    unread: true,
  },
  {
    id: 'n3',
    icon: Users,
    tone: 'warning',
    title: 'Seat limit approaching',
    body: '9 of 10 editor seats are in use.',
    time: '3h ago',
    unread: true,
  },
]

const meta = {
  title: 'Organisms/Notification panel',
  component: KNotificationPanel,
  args: { modelValue: seed() },
  render: () => ({
    components: { KNotificationPanel },
    setup() {
      const items = ref(seed())
      return { items, restore: () => (items.value = seed()) }
    },
    template: '<KNotificationPanel v-model="items" class="max-w-lg" @restore="restore" />',
  }),
} satisfies Meta<typeof KNotificationPanel>

export default meta
export const Default: StoryObj<typeof meta> = {}
