import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Bell, Search } from '@lucide/vue'

import GAvatar from './GAvatar.vue'
import GAvatarGroup from './GAvatarGroup.vue'
import GBadge from './GBadge.vue'
import GDivider from './GDivider.vue'
import GIcon from './GIcon.vue'
import GInput from './GInput.vue'
import GLabel from './GLabel.vue'
import GSpinner from './GSpinner.vue'

const meta = { title: 'Atoms/Display' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Avatars: Story = {
  render: () => ({
    components: { GAvatar, GAvatarGroup },
    template: `
      <div class="flex flex-wrap items-center gap-6">
        <GAvatar size="lg" tone="accent" online>AR</GAvatar>
        <GAvatar>MK</GAvatar>
        <GAvatar size="sm" tone="orange">JS</GAvatar>
        <GAvatarGroup>
          <GAvatar size="sm" tone="accent">AR</GAvatar>
          <GAvatar size="sm" tone="teal">PN</GAvatar>
          <GAvatar size="sm" tone="purple">VD</GAvatar>
          <GAvatar size="sm">+4</GAvatar>
        </GAvatarGroup>
      </div>`,
  }),
}

export const Badges: Story = {
  render: () => ({
    components: { GBadge },
    template: `
      <div class="flex flex-wrap items-center gap-2">
        <GBadge>Draft</GBadge>
        <GBadge tone="accent">3 new</GBadge>
        <GBadge tone="positive" dot>Settled</GBadge>
        <GBadge tone="warning" dot>Due Friday</GBadge>
        <GBadge tone="negative" dot>Overdue</GBadge>
      </div>`,
  }),
}

export const Fields: Story = {
  render: () => ({
    components: { GInput, GLabel },
    template: `
      <div class="flex max-w-[420px] flex-col gap-5">
        <div class="flex flex-col gap-1.5"><GLabel for="f1" required>Khata name</GLabel><GInput id="f1" placeholder="Goa trip" /></div>
        <div class="flex flex-col gap-1.5"><GLabel for="f2" optional>Note</GLabel><GInput id="f2" placeholder="Shared with the flat" /></div>
        <div class="flex flex-col gap-1.5"><GLabel for="f3">Amount</GLabel><GInput id="f3" model-value="abc" invalid /></div>
        <div class="flex flex-col gap-1.5"><GLabel for="f4" disabled>Currency</GLabel><GInput id="f4" model-value="INR" disabled /></div>
      </div>`,
  }),
}

export const IconsSpinnerDivider: Story = {
  name: 'Icon, spinner & divider',
  render: () => ({
    components: { GIcon, GSpinner, GDivider },
    setup: () => ({ Bell, Search }),
    template: `
      <div class="flex max-w-[420px] flex-col gap-4 rounded-xl bg-surface p-4">
        <div class="flex items-center gap-4 text-tint">
          <GIcon :icon="Bell" label="Notifications" />
          <GIcon :icon="Search" :size="24" />
          <GSpinner class="text-label-secondary" />
          <GSpinner :size="28" class="text-label-secondary" />
        </div>
        <GDivider />
        <span class="text-subhead text-label-secondary">Hairline separators, optionally inset like list rows.</span>
        <GDivider inset />
      </div>`,
  }),
}
