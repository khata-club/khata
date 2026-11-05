import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { House, LayoutGrid, User } from '@lucide/vue'
import { ref } from 'vue'

import KButton from './KButton.vue'
import KButtonGroup from './KButtonGroup.vue'
import KDivider from './KDivider.vue'
import KSegmentedControl from './KSegmentedControl.vue'
import KSegmentedTabs from './KSegmentedTabs.vue'

const meta = { title: 'Molecules/Segmented tabs & button group' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const TabsAndButtonGroup: Story = {
  name: 'Segmented tabs & button group',
  render: () => ({
    components: { KSegmentedTabs, KButton, KButtonGroup, KDivider },
    setup: () => ({
      tab: ref('home'),
      items: [
        { value: 'home', label: 'Home', icon: House },
        { value: 'projects', label: 'Projects', icon: LayoutGrid },
        { value: 'profile', label: 'Profile', icon: User },
      ],
    }),
    template: `
      <div class="flex max-w-xl flex-col gap-6">
        <KSegmentedTabs v-model="tab" :items="items" label="Sections">
          <template #home><p class="text-fg-muted m-0 text-sm">Home panel</p></template>
          <template #projects><p class="text-fg-muted m-0 text-sm">Projects panel</p></template>
          <template #profile><p class="text-fg-muted m-0 text-sm">Profile panel</p></template>
        </KSegmentedTabs>
        <KDivider decorative />
        <KButtonGroup label="Publishing actions">
          <KButton variant="ghost">Discard</KButton>
          <KButton variant="secondary">Preview</KButton>
          <KButton>Publish</KButton>
        </KButtonGroup>
      </div>`,
  }),
}

/** Pill picker used by charts (range, contribution) and forms. Radio semantics. */
export const SegmentedControl: Story = {
  render: () => ({
    components: { KSegmentedControl },
    setup: () => ({
      range: ref('1Y'),
      contrib: ref('1000'),
      ranges: ['6M', '1Y', '3Y', '5Y'].map((v) => ({ value: v, label: v })),
      contribs: [500, 1000, 2000].map((c) => ({
        value: String(c),
        label: '$' + c.toLocaleString('en-US') + '/mo',
      })),
    }),
    template: `
      <div class="flex flex-col items-start gap-6">
        <KSegmentedControl v-model="range" :options="ranges" label="Range" />
        <KSegmentedControl v-model="contrib" :options="contribs" label="Monthly contribution" size="sm" />
      </div>`,
  }),
}
