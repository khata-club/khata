import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Bell, CreditCard, Globe, Moon, ShieldCheck, Users } from '@lucide/vue'
import { ref } from 'vue'

import GListRow from './GListRow.vue'
import GListSection from './GListSection.vue'
import GSwitchRow from './GSwitchRow.vue'

const meta = { title: 'Molecules/Lists' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const InsetGrouped: Story = {
  name: 'Inset grouped',
  render: () => ({
    components: { GListSection, GListRow, GSwitchRow },
    setup: () => ({
      Bell,
      CreditCard,
      Globe,
      Moon,
      ShieldCheck,
      Users,
      notify: ref(true),
      dark: ref(false),
    }),
    template: `
      <div class="flex max-w-[480px] flex-col gap-8">
        <GListSection header="Account">
          <GListRow as="button" title="Members" :icon="Users" icon-color="var(--color-teal)" value="5" chevron />
          <GListRow as="button" title="Payment methods" :icon="CreditCard" icon-color="var(--color-green)" chevron />
          <GListRow as="button" title="Privacy" :icon="ShieldCheck" chevron />
        </GListSection>
        <GListSection header="Preferences" footer="Reminders go out once a week while a balance is open.">
          <GSwitchRow v-model="notify" title="Reminders" :icon="Bell" icon-color="var(--color-red)" />
          <GSwitchRow v-model="dark" title="Dark appearance" :icon="Moon" icon-color="var(--color-indigo)" />
          <GListRow as="button" title="Region" :icon="Globe" icon-color="var(--color-blue)" value="India" chevron />
        </GListSection>
        <GListSection header="Plain rows">
          <GListRow title="Created" value="12 Mar 2026" />
          <GListRow title="Entries" subtitle="Across all members" value="128" />
        </GListSection>
      </div>`,
  }),
}
