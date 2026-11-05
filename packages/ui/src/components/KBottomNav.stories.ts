import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Heart, House, Search, Settings } from '@lucide/vue'
import { ref } from 'vue'

import KBottomNav from './KBottomNav.vue'

const items = [
  { value: 'home', label: 'Home', icon: House },
  { value: 'search', label: 'Search', icon: Search },
  { value: 'favorites', label: 'Favorites', icon: Heart },
  { value: 'settings', label: 'Settings', icon: Settings },
]

const meta = {
  title: 'Organisms/Bottom navigation',
  component: KBottomNav,
  args: { items },
  render: (args) => ({
    components: { KBottomNav },
    setup: () => ({ args, v: ref('home') }),
    template: '<KBottomNav v-bind="args" v-model="v" class="max-w-[440px]" />',
  }),
} satisfies Meta<typeof KBottomNav>

export default meta
export const Default: StoryObj<typeof meta> = {}
