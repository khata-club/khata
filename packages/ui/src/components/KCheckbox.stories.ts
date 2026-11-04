import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import KCheckbox from './KCheckbox.vue'

const meta = {
  title: 'Atoms/Checkbox',
  component: KCheckbox,
  args: { disabled: false },
  render: (args) => ({
    components: { KCheckbox },
    setup: () => ({ args, on: ref(true) }),
    template: '<KCheckbox v-bind="args" v-model="on">Remember me</KCheckbox>',
  }),
} satisfies Meta<typeof KCheckbox>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** "Select all" reflects its children: checked, unchecked, or mixed. */
export const SelectAll: Story = {
  render: () => ({
    components: { KCheckbox },
    setup() {
      const items = ref([true, false, true])
      const all = computed<boolean | 'indeterminate'>({
        get: () => {
          const n = items.value.filter(Boolean).length
          return n === items.value.length ? true : n ? 'indeterminate' : false
        },
        set: (v) => (items.value = items.value.map(() => v === true)),
      })
      return { items, all, labels: ['Colors', 'Typography', 'Spacing'] }
    },
    template: `
      <div class="flex flex-col">
        <KCheckbox v-model="all" class="font-semibold">Select all</KCheckbox>
        <KCheckbox v-for="(l, i) in labels" :key="l" v-model="items[i]" class="pl-9">{{ l }}</KCheckbox>
        <KCheckbox :model-value="true" disabled>Locked</KCheckbox>
      </div>`,
  }),
}
