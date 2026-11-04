import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import KFormField from './KFormField.vue'
import KInput from './KInput.vue'

const meta = {
  title: 'Molecules/Form field',
  component: KFormField,
  args: { label: 'Work email', hint: 'We’ll send receipts here.', required: true },
  render: (args) => ({
    components: { KFormField, KInput },
    setup: () => ({ args }),
    template: `<KFormField v-bind="args" class="max-w-md"><template #default="{ field }"><KInput v-bind="field" type="email" placeholder="name@company.com" /></template></KFormField>`,
  }),
} satisfies Meta<typeof KFormField>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Validates on blur: hint → error → "Looks good." */
export const LiveValidation: Story = {
  render: () => ({
    components: { KFormField, KInput },
    setup() {
      const email = ref('')
      const touched = ref(false)
      const name = ref('Olivia')
      const valid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value))
      const error = computed(() =>
        touched.value && !valid.value ? 'Enter a valid email, like name@company.com.' : undefined,
      )
      const success = computed(() => (valid.value ? 'Looks good.' : undefined))
      return { email, touched, name, error, success }
    },
    template: `
      <div class="flex max-w-md flex-col gap-6">
        <KFormField label="Work email" required hint="We’ll send receipts here." hint-icon :error="error" :success="success">
          <template #default="{ field }">
            <KInput v-bind="field" v-model="email" type="email" placeholder="name@company.com" @blur="touched = true" />
          </template>
        </KFormField>
        <KFormField label="Display name" :counter="name.length + ' / 32'" hint="Shown on comments and shared files.">
          <template #default="{ field }"><KInput v-bind="field" v-model="name" maxlength="32" /></template>
        </KFormField>
      </div>`,
  }),
}
