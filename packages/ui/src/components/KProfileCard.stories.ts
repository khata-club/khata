import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Check, Ellipsis, Link, MessageCircle, User, UserPlus, UserX } from '@lucide/vue'
import { ref } from 'vue'

import KButton from './KButton.vue'
import KMenu from './KMenu.vue'
import KMenuContent from './KMenuContent.vue'
import KMenuItem from './KMenuItem.vue'
import KMenuTrigger from './KMenuTrigger.vue'
import KProfileCard from './KProfileCard.vue'

const meta = {
  title: 'Organisms/Profile card',
  component: KProfileCard,
  args: {
    name: 'Olivia Bennett',
    title: 'Product Designer',
    location: 'San Francisco, CA',
    online: true,
  },
  render: (args) => ({
    components: {
      KProfileCard,
      KButton,
      KMenu,
      KMenuTrigger,
      KMenuContent,
      KMenuItem,
      Ellipsis,
      User,
      Link,
      UserX,
      MessageCircle,
      Check,
      UserPlus,
    },
    setup() {
      const follow = ref(false)
      const copied = ref(false)
      const copy = (e: Event) => {
        e.preventDefault()
        copied.value = true
        setTimeout(() => (copied.value = false), 1100)
      }
      return { args, follow, copied, copy }
    },
    template: `
      <KProfileCard v-bind="args" class="max-w-lg">
        <template #menu>
          <KMenu v-slot="{ open }">
            <KMenuTrigger>
              <KButton variant="neutral" icon-only aria-label="More actions" :class="['rounded-lg', open && 'shadow-recessed']"><Ellipsis /></KButton>
            </KMenuTrigger>
            <KMenuContent>
              <KMenuItem><User />View profile</KMenuItem>
              <KMenuItem @select="copy"><Link />{{ copied ? 'Link copied' : 'Copy profile link' }}</KMenuItem>
              <KMenuItem tone="danger"><UserX />Remove from team</KMenuItem>
            </KMenuContent>
          </KMenu>
        </template>
        <template #actions>
          <KButton class="px-4"><MessageCircle />Message</KButton>
          <KButton variant="secondary" class="px-4" :aria-pressed="follow" :class="follow && 'bg-primary-subtle shadow-recessed'" @click="follow = !follow">
            <Check v-if="follow" /><UserPlus v-else />{{ follow ? 'Following' : 'Follow' }}
          </KButton>
        </template>
      </KProfileCard>`,
  }),
} satisfies Meta<typeof KProfileCard>

export default meta
export const Default: StoryObj<typeof meta> = {}
