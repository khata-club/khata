import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ArrowRight, Ellipsis, Heart, Plus, Share, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import GButton from './GButton.vue'
import GToggleButton from './GToggleButton.vue'

const meta = {
  title: 'Atoms/Button',
  component: GButton,
  argTypes: {
    variant: {
      control: 'select',
      options: ['filled', 'glass', 'tinted', 'gray', 'plain', 'destructive'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  args: { variant: 'filled', size: 'md', loading: false, disabled: false, iconOnly: false },
  render: (args) => ({
    components: { GButton },
    setup: () => ({ args }),
    template: '<GButton v-bind="args">Continue</GButton>',
  }),
} satisfies Meta<typeof GButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  render: () => ({
    components: { GButton, ArrowRight, Trash2 },
    template: `
      <div class="flex flex-col gap-8">
        <div class="flex flex-wrap items-center gap-3">
          <GButton size="lg" class="group">Continue<ArrowRight class="transition-transform duration-(--duration-spring) ease-bouncy group-hover:translate-x-0.5" /></GButton>
          <GButton size="lg" variant="tinted">Tinted</GButton>
          <GButton size="lg" variant="gray">Gray</GButton>
          <GButton size="lg" variant="plain">Plain</GButton>
          <GButton size="lg" variant="destructive"><Trash2 />Delete</GButton>
        </div>
        <p class="m-0 max-w-[560px] text-subhead text-label-secondary">
          Use one filled button per view. Tinted, gray and plain sit on content surfaces; glass is
          for controls that float over content (see “Over content”).
        </p>
      </div>`,
  }),
}

export const OverContent: Story = {
  name: 'Over content',
  parameters: { backdrop: 'Wallpaper' },
  render: () => ({
    components: { GButton, Share, Plus, Ellipsis },
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <GButton variant="glass" icon-only aria-label="Share"><Share /></GButton>
        <GButton variant="glass">Edit</GButton>
        <GButton variant="glass" icon-only aria-label="More"><Ellipsis /></GButton>
        <GButton icon-only aria-label="Add"><Plus /></GButton>
      </div>`,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { GButton, GToggleButton, Ellipsis, Heart },
    setup: () => ({ liked: ref(false) }),
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <GButton size="sm">Small</GButton>
        <GButton size="md">Medium</GButton>
        <GButton size="lg">Large</GButton>
        <span class="h-8 w-px bg-separator" />
        <GButton variant="gray" icon-only aria-label="More options"><Ellipsis /></GButton>
        <GToggleButton v-model="liked" aria-label="Favourite"><Heart /></GToggleButton>
      </div>`,
  }),
}

export const States: Story = {
  render: () => ({
    components: { GButton },
    setup() {
      const loading = ref(false)
      const save = () => {
        loading.value = true
        setTimeout(() => (loading.value = false), 1600)
      }
      return { loading, save }
    },
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <GButton :loading="loading" @click="save">Save changes</GButton>
        <GButton disabled>Disabled</GButton>
        <GButton variant="gray" disabled>Disabled gray</GButton>
        <span class="text-subhead text-label-secondary">Press and hold: buttons dip, then spring back.</span>
      </div>`,
  }),
}
