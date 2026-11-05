import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { UserRound } from '@lucide/vue'

import KAvatar from './KAvatar.vue'
import KAvatarGroup from './KAvatarGroup.vue'

const meta = {
  title: 'Atoms/Avatar',
  component: KAvatar,
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    tone: { control: 'select', options: ['subtle', 'soft', 'primary', 'muted'] },
  },
  args: { size: 'md', tone: 'primary', online: false },
  render: (args) => ({
    components: { KAvatar },
    setup: () => ({ args }),
    template: '<KAvatar v-bind="args">MK</KAvatar>',
  }),
} satisfies Meta<typeof KAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: () => ({
    components: { KAvatar, KAvatarGroup, UserRound },
    template: `
      <div class="flex flex-wrap items-end gap-8">
        <div class="flex flex-col items-center gap-2"><KAvatar size="sm">OB</KAvatar><span class="text-fg-muted font-mono text-xs">sm</span></div>
        <div class="flex flex-col items-center gap-2"><KAvatar tone="primary">MK</KAvatar><span class="text-fg-muted font-mono text-xs">md</span></div>
        <div class="flex flex-col items-center gap-2"><KAvatar size="lg" online class="text-primary"><UserRound aria-hidden="true" /></KAvatar><span class="text-fg-muted font-mono text-xs">lg · online</span></div>
        <div class="flex flex-col items-center gap-2">
          <KAvatarGroup>
            <KAvatar tone="soft" class="text-sm">AL</KAvatar>
            <KAvatar tone="muted" class="text-sm">JR</KAvatar>
            <KAvatar tone="primary" class="text-sm">+4</KAvatar>
          </KAvatarGroup>
          <span class="text-fg-muted font-mono text-xs">group</span>
        </div>
      </div>`,
  }),
}
