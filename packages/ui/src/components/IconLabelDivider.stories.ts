import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Heart,
  House,
  LayoutGrid,
  MapPin,
  Search,
  Settings,
  SlidersHorizontal,
  User,
  X,
} from '@lucide/vue'

import KDivider from './KDivider.vue'
import KIcon from './KIcon.vue'
import KLabel from './KLabel.vue'

const meta = {
  title: 'Atoms/Icon, label & divider',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Icons: Story = {
  render: () => ({
    components: { KIcon, KDivider },
    setup: () => ({
      House,
      set: [
        Search,
        Heart,
        Settings,
        Bell,
        MapPin,
        Check,
        X,
        ArrowRight,
        ChevronDown,
        SlidersHorizontal,
        User,
        LayoutGrid,
      ],
    }),
    template: `
      <div class="flex flex-wrap items-end gap-6">
        <div v-for="s in [16, 20, 24]" :key="s" class="flex flex-col items-center gap-2">
          <KIcon :icon="House" :size="s" class="text-fg" />
          <span class="text-fg-muted font-mono text-xs">{{ s }}</span>
        </div>
        <KDivider orientation="vertical" decorative class="h-10" />
        <div class="text-fg-muted flex flex-wrap gap-4">
          <KIcon v-for="(ic, i) in set" :key="i" :icon="ic" />
        </div>
      </div>`,
  }),
}

export const LabelsAndDividers: Story = {
  name: 'Labels & dividers',
  render: () => ({
    components: { KLabel, KDivider },
    template: `
      <div class="flex flex-wrap items-center gap-6">
        <KLabel>Label</KLabel>
        <KLabel required>Required</KLabel>
        <KLabel optional>Nickname</KLabel>
        <KLabel disabled>Disabled</KLabel>
        <span class="text-fg-muted flex items-center gap-3 text-sm">Draft<KDivider orientation="vertical" />Edited 2m ago</span>
      </div>`,
  }),
}
