import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ArrowRight, Ellipsis, Heart, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import KButton from './KButton.vue'
import KToggleButton from './KToggleButton.vue'

const meta = {
  title: 'Atoms/Button',
  component: KButton,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'neutral', 'danger'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  args: { variant: 'primary', size: 'md', loading: false, disabled: false, iconOnly: false },
  render: (args) => ({
    components: { KButton },
    setup: () => ({ args }),
    template: '<KButton v-bind="args">Save changes</KButton>',
  }),
} satisfies Meta<typeof KButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  render: () => ({
    components: { KButton, ArrowRight, Trash2 },
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <KButton size="lg" class="group">Primary<ArrowRight class="ease-standard transition-transform duration-(--duration-slow) group-hover:translate-x-1 group-focus-visible:translate-x-1" /></KButton>
        <KButton size="lg" variant="secondary">Secondary</KButton>
        <KButton size="lg" variant="outline">Outline</KButton>
        <KButton size="lg" variant="ghost">Ghost</KButton>
        <KButton size="lg" variant="danger"><Trash2 />Danger</KButton>
      </div>`,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { KButton, KToggleButton, Ellipsis, Heart },
    setup: () => ({ liked: ref(false) }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <KButton size="sm">Small</KButton>
        <KButton size="md">Medium</KButton>
        <KButton size="lg">Large</KButton>
        <span class="bg-line h-8 w-px" />
        <KButton variant="neutral" icon-only aria-label="More options"><Ellipsis /></KButton>
        <KToggleButton v-model="liked" label="Favorite"><Heart /></KToggleButton>
      </div>`,
  }),
}

export const States: Story = {
  render: () => ({
    components: { KButton },
    setup() {
      const loading = ref(false)
      const save = () => {
        loading.value = true
        setTimeout(() => (loading.value = false), 1600)
      }
      return { loading, save }
    },
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <KButton :loading="loading" class="min-w-[172px]" @click="save">{{ loading ? 'Saving…' : 'Save changes' }}</KButton>
        <KButton disabled>Disabled</KButton>
        <KButton variant="outline" disabled>Disabled outline</KButton>
        <span class="text-fg-muted text-sm">Press any button to feel the inset. Tab to see the focus ring.</span>
      </div>`,
  }),
}
