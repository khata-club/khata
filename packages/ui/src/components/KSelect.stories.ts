import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Briefcase } from '@lucide/vue'
import { ref } from 'vue'

import KLabel from './KLabel.vue'
import KSelect from './KSelect.vue'

const roles = ['Product Designer', 'Design Engineer', 'UX Researcher', 'Product Manager'].map(
  (r) => ({
    value: r,
    label: r,
  }),
)

const meta = {
  title: 'Molecules/Dropdown select',
  component: KSelect,
  args: { options: roles, disabled: false, invalid: false },
  render: (args) => ({
    components: { KSelect, KLabel, Briefcase },
    setup: () => ({ args, role: ref('Product Designer') }),
    template: `
      <div class="flex max-w-md flex-col gap-2">
        <KLabel for="role">Role</KLabel>
        <KSelect id="role" v-bind="args" v-model="role"><template #icon><Briefcase /></template></KSelect>
        <span class="text-fg-muted mt-4 text-sm">Arrow keys move between options. Esc closes.</span>
      </div>`,
  }),
} satisfies Meta<typeof KSelect>

export default meta
export const Default: StoryObj<typeof meta> = {}
export const Disabled: StoryObj<typeof meta> = { args: { disabled: true } }
