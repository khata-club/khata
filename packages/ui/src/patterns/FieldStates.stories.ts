import type { Meta, StoryObj } from '@storybook/vue3-vite'

import KCheckbox from '../components/KCheckbox.vue'
import KRadio from '../components/KRadio.vue'
import KRadioGroup from '../components/KRadioGroup.vue'
import KSwitch from '../components/KSwitch.vue'
import KTextField from '../forms/KTextField.vue'

/** Every state a field can be in, frozen for spec review. */
const meta = { title: 'Patterns/Field states', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const TextField: Story = {
  render: () => ({
    components: { KTextField },
    template: `
      <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-5 gap-y-6">
        <div v-for="s in states" :key="s.name" class="flex flex-col gap-2">
          <span class="text-fg-muted font-mono text-xs">{{ s.name }}</span>
          <KTextField label="Label" v-bind="s.props" :model-value="s.value" />
        </div>
      </div>`,
    setup: () => ({
      states: [
        { name: 'default', value: '', props: { placeholder: 'Placeholder', hint: 'Helper text' } },
        { name: 'filled', value: 'Olivia Bennett', props: { hint: 'Helper text' } },
        {
          name: 'validating',
          value: 'olivia@north.co',
          props: { status: 'loading', message: 'Checking availability…' },
        },
        { name: 'valid', value: 'northwind', props: { status: 'valid', message: 'Available' } },
        { name: 'warning', value: '415 555', props: { status: 'warning', message: 'Looks short' } },
        {
          name: 'error',
          value: 'olivia@',
          props: { status: 'error', message: 'Use name@company.com' },
        },
        {
          name: 'error · multi-line',
          value: '',
          props: {
            status: 'error',
            message: 'This cannot be the same as one of your last 3 passwords.',
          },
        },
        { name: 'disabled', value: 'Not editable', props: { disabled: true, hint: 'Helper text' } },
        {
          name: 'read-only',
          value: 'GB 284 1937 22',
          props: { readonly: true, mono: true, hint: 'Helper text' },
        },
      ],
    }),
  }),
}

export const SelectionControls: Story = {
  render: () => ({
    components: { KCheckbox, KRadio, KRadioGroup, KSwitch },
    template: `
      <div class="grid min-w-[620px] grid-cols-[96px_repeat(6,minmax(72px,1fr))] items-center gap-x-4 gap-y-5">
        <span />
        <span v-for="h in ['off', 'on', 'mixed', 'error', 'disabled', 'disabled on']" :key="h" class="text-fg-muted font-mono text-xs">{{ h }}</span>

        <span class="text-sm font-semibold">Checkbox</span>
        <KCheckbox aria-label="Off" :model-value="false" />
        <KCheckbox aria-label="On" :model-value="true" />
        <KCheckbox aria-label="Mixed" model-value="indeterminate" />
        <KCheckbox aria-label="Error" :model-value="false" invalid />
        <KCheckbox aria-label="Disabled" :model-value="false" disabled />
        <KCheckbox aria-label="Disabled on" :model-value="true" disabled />

        <span class="text-sm font-semibold">Radio</span>
        <KRadioGroup aria-label="Off"><KRadio value="a" aria-label="Off" /></KRadioGroup>
        <KRadioGroup model-value="a" aria-label="On"><KRadio value="a" aria-label="On" /></KRadioGroup>
        <span class="text-fg-disabled font-mono text-xs">n/a</span>
        <KRadioGroup aria-label="Error"><KRadio value="a" aria-label="Error" invalid /></KRadioGroup>
        <KRadioGroup aria-label="Disabled"><KRadio value="a" aria-label="Disabled" disabled /></KRadioGroup>
        <KRadioGroup model-value="a" aria-label="Disabled on"><KRadio value="a" aria-label="Disabled on" disabled /></KRadioGroup>

        <span class="text-sm font-semibold">Switch</span>
        <KSwitch aria-label="Off" :model-value="false" />
        <KSwitch aria-label="On" :model-value="true" />
        <span class="text-fg-disabled font-mono text-xs">n/a</span>
        <KSwitch aria-label="Error" :model-value="false" invalid />
        <KSwitch aria-label="Disabled" :model-value="false" disabled />
        <KSwitch aria-label="Disabled on" :model-value="true" disabled />
      </div>`,
  }),
}
