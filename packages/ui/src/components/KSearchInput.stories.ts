import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { SlidersHorizontal } from '@lucide/vue'
import { ref } from 'vue'

import KSearchInput from './KSearchInput.vue'

const meta = {
  title: 'Molecules/Search input',
  component: KSearchInput,
  render: (args) => ({
    components: { KSearchInput, SlidersHorizontal },
    setup() {
      const q = ref('')
      const filters = ref(false)
      return { args, q, filters }
    },
    template: `
      <div class="flex max-w-xl flex-col gap-6">
        <KSearchInput v-bind="args" v-model="q">
          <template #actions>
            <button type="button" aria-label="Filters" :aria-pressed="filters"
              :class="['grid size-(--touch-target) shrink-0 cursor-pointer place-items-center rounded-full border-0 transition-[background-color,color] duration-(--duration-normal) active:scale-[0.94]', filters ? 'bg-primary-subtle text-primary' : 'text-fg-muted bg-transparent']"
              @click="filters = !filters">
              <SlidersHorizontal :size="22" aria-hidden="true" :class="['ease-standard transition-transform duration-(--duration-slow)', filters && 'rotate-180']" />
            </button>
          </template>
        </KSearchInput>
        <span class="text-fg-muted text-sm">{{ q ? 'Searching for “' + q + '”' + (filters ? ' with filters' : '') : filters ? 'Filters on. Start typing to search.' : 'Recessed field with clear and filter actions.' }}</span>
      </div>`,
  }),
} satisfies Meta<typeof KSearchInput>

export default meta
export const Default: StoryObj<typeof meta> = {}
