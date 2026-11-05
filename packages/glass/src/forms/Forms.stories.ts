import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { AtSign, Search } from '@lucide/vue'
import { ref } from 'vue'

import GButton from '../components/GButton.vue'
import GBanner from './GBanner.vue'
import GChoiceCards from './GChoiceCards.vue'
import GErrorSummary from './GErrorSummary.vue'
import GFormProgress from './GFormProgress.vue'
import GTextarea from './GTextarea.vue'
import GTextField from './GTextField.vue'

const meta = { title: 'Forms/Fields' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const TextFields: Story = {
  name: 'Text field states',
  render: () => ({
    components: { GTextField, AtSign, Search },
    template: `
      <div class="grid max-w-[760px] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-x-6 gap-y-5">
        <GTextField label="Name" placeholder="Aarav Rao" hint="As it appears to your group." required />
        <GTextField label="Email" model-value="aarav@khata.club" status="loading" message="Checking availability…"><template #leading><AtSign /></template></GTextField>
        <GTextField label="Group URL" model-value="goa-trip" status="valid" message="khata.club/goa-trip is available" />
        <GTextField label="Email" model-value="aarav@gmail.com" status="warning" message="Personal address — use a work email to invite colleagues." />
        <GTextField label="Amount" model-value="12,00" status="error" message="Use a full stop for decimals." />
        <GTextField label="Card number" model-value="4242 4242 4242 4242" mono readonly hint="Read-only." />
        <GTextField label="Currency" model-value="INR" disabled hint="Set by your region." />
        <GTextField label="Search" placeholder="Search entries" optional><template #leading><Search /></template></GTextField>
      </div>`,
  }),
}

export const Textarea: Story = {
  render: () => ({
    components: { GTextarea },
    setup: () => ({ v: ref('Dinner at Bombay Canteen, split four ways.') }),
    template: `
      <div class="flex max-w-[480px] flex-col gap-5">
        <GTextarea v-model="v" label="Note" :max="80" hint="Visible to everyone in the khata." />
        <GTextarea label="Reason" model-value="" status="error" message="Add a short reason for the refund." required />
      </div>`,
  }),
}

export const ChoiceCards: Story = {
  name: 'Choice cards',
  render: () => ({
    components: { GChoiceCards, GButton },
    setup: () => ({ v: ref<string>(), n: ref(0) }),
    template: `
      <div class="flex max-w-[620px] flex-col gap-4">
        <GChoiceCards v-model="v" label="Split" :invalid="!v && n > 0" :shake-key="n" :options="[
          { value: 'even', label: 'Evenly', description: 'Everyone pays the same' },
          { value: 'shares', label: 'By shares', description: 'Weight by people' },
          { value: 'exact', label: 'Exact', description: 'Type each amount' },
          { value: 'pct', label: 'Percent', description: 'Coming soon', disabled: true },
        ]" />
        <GButton class="self-start" @click="n++">Continue</GButton>
        <span class="text-footnote text-label-secondary">Continue without choosing to see the nudge.</span>
      </div>`,
  }),
}

export const Summaries: Story = {
  name: 'Banners & summaries',
  render: () => ({
    components: { GBanner, GErrorSummary, GFormProgress, GButton },
    template: `
      <div class="flex flex-wrap items-start gap-6">
        <div class="flex max-w-[520px] flex-[1_1_360px] flex-col gap-3">
          <GErrorSummary title="2 fields need attention" :items="[{ id: 'x', label: 'Email', message: 'Enter a valid email address.' }, { id: 'y', label: 'Amount', message: 'Use a full stop for decimals.' }]" />
          <GBanner tone="positive" title="Khata created">Invites go out when you add members.<template #action><GButton size="sm" variant="gray">View</GButton></template></GBanner>
          <GBanner tone="accent" title="Draft saved">You can finish this later.</GBanner>
          <GBanner tone="warning" title="Unsaved changes">Leave anyway?</GBanner>
          <GBanner title="Locked for review">An admin is reviewing this request.</GBanner>
        </div>
        <GFormProgress :done="5" :total="8" class="w-[300px]" :sections="[
          { href: '#a', title: 'Account', meta: 'Complete', state: 'complete' },
          { href: '#b', title: 'Group', meta: '2 issues', state: 'error' },
          { href: '#c', title: 'Billing', meta: '1 of 3', state: 'pending' },
        ]" />
      </div>`,
  }),
}
