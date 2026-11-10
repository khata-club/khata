import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { CircleCheck } from '@lucide/vue'
import { ref } from 'vue'

import KButton from './KButton.vue'
import KFormField from './KFormField.vue'
import KFormSection from './KFormSection.vue'
import KInput from './KInput.vue'
import KSwitchCard from './KSwitchCard.vue'

const meta = {
  title: 'Organisms/Form section',
  component: KFormSection,
  args: { title: 'Account details', description: 'Visible to people in your workspace.' },
  render: (args) => ({
    components: { KFormSection, KFormField, KInput, KSwitchCard, KButton, CircleCheck },
    setup() {
      const initial = { name: 'Olivia Bennett', title: 'Product Designer', updates: true }
      const f = ref({ ...initial })
      const saving = ref(false)
      const saved = ref(false)
      const save = () => {
        if (saving.value) return
        saving.value = true
        saved.value = false
        setTimeout(() => ((saving.value = false), (saved.value = true)), 1200)
      }
      const reset = () => ((f.value = { ...initial }), (saved.value = false))
      return { args, f, saving, saved, save, reset }
    },
    template: `
      <KFormSection v-bind="args" class="max-w-xl" @submit="save">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          <KFormField label="Full name"><template #default="{ field }"><KInput v-bind="field" v-model="f.name" @input="saved = false" /></template></KFormField>
          <KFormField label="Job title"><template #default="{ field }"><KInput v-bind="field" v-model="f.title" @input="saved = false" /></template></KFormField>
        </div>
        <KSwitchCard v-model="f.updates" title="Product updates" description="A short email when new components ship." />
        <template #footer>
          <span role="status" :class="['text-success mr-auto flex items-center gap-2 text-sm font-semibold transition-[opacity,translate] duration-(--duration-slow)', saved ? 'opacity-100' : 'translate-y-1 opacity-0']">
            <CircleCheck v-if="saved" :size="16" aria-hidden="true" />{{ saved ? 'Changes saved' : '' }}
          </span>
          <KButton variant="ghost" @click="reset">Reset</KButton>
          <KButton type="submit" :loading="saving" class="min-w-[150px]">{{ saving ? 'Saving…' : 'Save changes' }}</KButton>
        </template>
      </KFormSection>`,
  }),
} satisfies Meta<typeof KFormSection>

export default meta
export const Default: StoryObj<typeof meta> = {}
