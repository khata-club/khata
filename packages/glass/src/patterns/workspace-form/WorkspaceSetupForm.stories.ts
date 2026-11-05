import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkspaceSetupForm from './WorkspaceSetupForm.vue'

/**
 * Full workspace-setup form built from Glass Kit parts. The prototype's "Tweaks" are args:
 * when errors appear, whether the linked error summary shows, and how required fields are marked.
 * Use the "Form state" switcher in the page to inspect Pristine, Partial errors, Submitting,
 * Success and Disabled.
 */
const meta = {
  title: 'Patterns/Workspace setup form',
  component: WorkspaceSetupForm,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    validateOn: { control: 'inline-radio', options: ['blur', 'change', 'submit'] },
    requiredStyle: { control: 'inline-radio', options: ['asterisk', 'optional'] },
    initialMode: {
      control: 'select',
      options: ['pristine', 'partial', 'submitting', 'success', 'locked'],
    },
  },
  args: {
    validateOn: 'blur',
    errorSummary: true,
    requiredStyle: 'asterisk',
    initialMode: 'partial',
  },
} satisfies Meta<typeof WorkspaceSetupForm>

export default meta
type Story = StoryObj<typeof meta>

export const PartialErrors: Story = {}
export const Pristine: Story = { args: { initialMode: 'pristine' } }
export const Success: Story = { args: { initialMode: 'success' } }
export const Disabled: Story = { args: { initialMode: 'locked' } }
export const OptionalLabels: Story = {
  args: { initialMode: 'pristine', requiredStyle: 'optional' },
}
