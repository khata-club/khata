import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Minus, Plus } from '@lucide/vue'
import { ref } from 'vue'

import KButton from './KButton.vue'
import KProgress from './KProgress.vue'

const meta = {
  title: 'Molecules/Progress bar',
  component: KProgress,
  args: { value: 64, label: 'Uploading brand assets', showValue: true },
  render: (args) => ({
    components: { KProgress, KButton, Minus, Plus },
    setup() {
      const v = ref<number>(args.value ?? 64)
      const ind = ref(false)
      const step = (d: number) => (v.value = Math.max(0, Math.min(100, v.value + d)))
      return { args, v, ind, step }
    },
    template: `
      <div class="flex max-w-xl flex-col gap-6">
        <KProgress :label="args.label" :show-value="args.showValue" :value="ind ? null : v" />
        <div class="flex flex-wrap items-center gap-3">
          <KButton variant="neutral" icon-only aria-label="Decrease progress" class="size-(--touch-target)" @click="step(-12)"><Minus /></KButton>
          <KButton variant="neutral" icon-only aria-label="Increase progress" class="size-(--touch-target)" @click="step(12)"><Plus /></KButton>
          <KButton size="sm" :variant="ind ? 'secondary' : 'outline'" :aria-pressed="ind" @click="ind = !ind">Indeterminate</KButton>
        </div>
      </div>`,
  }),
} satisfies Meta<typeof KProgress>

export default meta
export const Default: StoryObj<typeof meta> = {}
export const Indeterminate: StoryObj<typeof meta> = {
  render: () => ({
    components: { KProgress },
    template: '<KProgress class="max-w-xl" label="Preparing export" :value="null" />',
  }),
}
