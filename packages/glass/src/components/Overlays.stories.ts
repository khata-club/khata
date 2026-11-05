import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Copy, Ellipsis, Pencil, Share, Trash2, Wallet } from '@lucide/vue'
import { ref } from 'vue'

import GAlertDialog from './GAlertDialog.vue'
import GButton from './GButton.vue'
import GDialog from './GDialog.vue'
import GFormField from './GFormField.vue'
import GInput from './GInput.vue'
import GLabel from './GLabel.vue'
import GMenu from './GMenu.vue'
import GMenuContent from './GMenuContent.vue'
import GMenuItem from './GMenuItem.vue'
import GMenuSeparator from './GMenuSeparator.vue'
import GMenuTrigger from './GMenuTrigger.vue'
import GSelect from './GSelect.vue'

const meta = { title: 'Molecules/Overlays' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Menu: Story = {
  parameters: { backdrop: 'Wallpaper' },
  render: () => ({
    components: {
      GMenu,
      GMenuTrigger,
      GMenuContent,
      GMenuItem,
      GMenuSeparator,
      GButton,
      Ellipsis,
      Pencil,
      Copy,
      Share,
      Trash2,
    },
    template: `
      <div class="flex justify-center pt-4 pb-72">
        <GMenu>
          <GMenuTrigger><GButton variant="glass" icon-only aria-label="More actions"><Ellipsis /></GButton></GMenuTrigger>
          <GMenuContent align="center">
            <GMenuItem>Rename<Pencil /></GMenuItem>
            <GMenuItem>Duplicate<Copy /></GMenuItem>
            <GMenuItem>Share<Share /></GMenuItem>
            <GMenuSeparator />
            <GMenuItem tone="destructive">Delete khata<Trash2 /></GMenuItem>
          </GMenuContent>
        </GMenu>
      </div>`,
  }),
}

export const Select: Story = {
  render: () => ({
    components: { GSelect, GLabel, Wallet },
    setup: () => ({
      v: ref('inr'),
      options: [
        { value: 'inr', label: 'Indian rupee (₹)' },
        { value: 'usd', label: 'US dollar ($)' },
        { value: 'eur', label: 'Euro (€)' },
        { value: 'gbp', label: 'Pound sterling (£)', disabled: true },
      ],
    }),
    template: `
      <div class="flex max-w-[360px] flex-col gap-1.5 pb-64">
        <GLabel for="cur">Currency</GLabel>
        <GSelect id="cur" v-model="v" :options="options"><template #icon><Wallet /></template></GSelect>
      </div>`,
  }),
}

export const Dialog: Story = {
  render: () => ({
    components: { GDialog, GButton, GFormField, GInput },
    setup: () => ({ open: ref(false) }),
    template: `
      <GDialog v-model:open="open" title="New khata" description="Give it a name your group will recognise.">
        <template #trigger><GButton>New khata</GButton></template>
        <GFormField label="Name" hint="You can change this later." v-slot="{ field }">
          <GInput v-bind="field" placeholder="Goa trip" />
        </GFormField>
        <template #footer>
          <GButton variant="gray" @click="open = false">Cancel</GButton>
          <GButton @click="open = false">Create</GButton>
        </template>
      </GDialog>`,
  }),
}

export const AlertDialog: Story = {
  name: 'Alert',
  render: () => ({
    components: { GAlertDialog, GButton, Trash2 },
    setup() {
      const open = ref(false)
      const loading = ref(false)
      const confirm = () => {
        loading.value = true
        setTimeout(() => {
          loading.value = false
          open.value = false
        }, 1200)
      }
      return { open, loading, confirm }
    },
    template: `
      <GAlertDialog v-model:open="open" title="Delete “Goa trip”?" description="Its entries and balances are removed for everyone in the group." confirm-label="Delete" loading-label="Deleting…" :loading="loading" @confirm="confirm">
        <template #trigger><GButton variant="destructive"><Trash2 />Delete khata</GButton></template>
      </GAlertDialog>`,
  }),
}
