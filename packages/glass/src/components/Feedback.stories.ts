import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { BadgeIndianRupee, CalendarClock, UserPlus } from '@lucide/vue'
import { onBeforeUnmount, ref } from 'vue'

import GAlert from './GAlert.vue'
import GButton from './GButton.vue'
import GNotificationPanel, { type Notification } from './GNotificationPanel.vue'
import GProfileCard from './GProfileCard.vue'
import GProfileSummary from './GProfileSummary.vue'
import GProgress from './GProgress.vue'
import GSearchInput from './GSearchInput.vue'

const meta = { title: 'Molecules/Feedback' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Alerts: Story = {
  render: () => ({
    components: { GAlert, GButton },
    setup: () => ({ shown: ref([true, true, true, true]) }),
    template: `
      <div class="flex max-w-[520px] flex-col">
        <GAlert v-model:open="shown[0]" title="Invite sent">Priya will see the khata once she accepts.</GAlert>
        <GAlert v-model:open="shown[1]" tone="positive" title="All settled">Nobody owes anything in “Flat 4B”.</GAlert>
        <GAlert v-model:open="shown[2]" tone="warning" title="Balance open for 9 days">A gentle reminder goes out tomorrow.</GAlert>
        <GAlert v-model:open="shown[3]" tone="negative" title="Couldn’t sync">Check your connection and try again.</GAlert>
        <GButton variant="plain" class="self-start" @click="shown = [true, true, true, true]">Show all</GButton>
      </div>`,
  }),
}

export const Progress: Story = {
  render: () => ({
    components: { GProgress, GButton },
    setup() {
      const v = ref(35)
      return { v }
    },
    template: `
      <div class="flex max-w-[420px] flex-col gap-6 rounded-xl bg-surface p-5">
        <GProgress :value="v" label="Trip budget used" />
        <GProgress :value="null" label="Importing statement" :show-value="false" />
        <div class="flex gap-2"><GButton size="sm" variant="gray" @click="v = Math.max(0, v - 20)">−20</GButton><GButton size="sm" variant="gray" @click="v = Math.min(100, v + 20)">+20</GButton></div>
      </div>`,
  }),
}

const seed = (): Notification[] => [
  {
    id: '1',
    icon: BadgeIndianRupee,
    title: 'Rohan paid you ₹1,200',
    body: 'Dinner at Bombay Canteen, settled.',
    time: 'now',
    unread: true,
    tone: 'positive',
  },
  {
    id: '2',
    icon: UserPlus,
    title: 'Priya joined “Goa trip”',
    body: 'She can now add and split entries.',
    time: '9m',
    unread: true,
  },
  {
    id: '3',
    icon: CalendarClock,
    title: 'Rent is due Friday',
    body: 'Your share is ₹14,500.',
    time: '2h',
    tone: 'warning',
  },
]

export const Notifications: Story = {
  parameters: { backdrop: 'Wallpaper' },
  render: () => ({
    components: { GNotificationPanel },
    setup: () => {
      const items = ref(seed())
      return { items, restore: () => (items.value = seed()) }
    },
    template: `<GNotificationPanel v-model="items" class="max-w-[420px]" @restore="restore" />`,
  }),
}

export const SearchAndProfile: Story = {
  name: 'Search & profile',
  render: () => ({
    components: { GSearchInput, GProfileCard, GProfileSummary, GButton },
    setup: () => {
      const q = ref('')
      onBeforeUnmount(() => (q.value = ''))
      return { q }
    },
    template: `
      <div class="flex max-w-[440px] flex-col gap-6">
        <GSearchInput v-model="q" placeholder="Search khatas" />
        <GProfileCard name="Aarav Rao" title="Organiser · 4 khatas" location="Bengaluru" online>
          <template #avatar>AR</template>
          <template #actions><GButton variant="tinted">Message</GButton><GButton variant="gray">Settle up</GButton></template>
        </GProfileCard>
        <div class="flex flex-col gap-3 rounded-xl bg-surface p-4">
          <GProfileSummary name="Meera Kapoor" subtitle="Owes you ₹640" initials="MK" tone="purple" />
          <GProfileSummary name="Jay Shah" subtitle="Settled" initials="JS" size="sm" tone="orange" />
        </div>
      </div>`,
  }),
}
