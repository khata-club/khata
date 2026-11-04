import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import KAlertDialog from './KAlertDialog.vue'
import KButton from './KButton.vue'
import KDialog from './KDialog.vue'

const meta = { title: 'Organisms/Modal dialog' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** Focus moves into the dialog and is trapped; Esc or the backdrop closes it; focus returns to the trigger. */
export const DestructiveConfirmation: Story = {
  render: () => ({
    components: { KAlertDialog, KButton, Trash2 },
    setup() {
      const open = ref(false)
      const deleting = ref(false)
      const deleted = ref(false)
      const confirm = () => {
        deleting.value = true
        setTimeout(
          () => ((open.value = false), (deleting.value = false), (deleted.value = true)),
          900,
        )
      }
      return { open, deleting, deleted, confirm }
    },
    template: `
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex flex-[1_1_360px] flex-col gap-1">
          <span class="text-lg font-semibold">{{ deleted ? '“Calm Mobile” was deleted.' : 'Destructive confirmation' }}</span>
          <span class="text-fg-muted text-sm">Focus moves into the dialog on open and stays trapped while it is open. Esc or the backdrop closes it, and focus returns to the trigger.</span>
        </div>
        <div class="flex flex-wrap gap-3">
          <KButton v-if="deleted" variant="secondary" @click="deleted = false">Undo</KButton>
          <KAlertDialog v-model:open="open" title="Delete “Calm Mobile”?" description="This removes the project and its 24 files for everyone on your team."
            confirm-label="Delete project" loading-label="Deleting…" :loading="deleting" @confirm="confirm">
            <template #trigger><KButton variant="danger" :disabled="deleted"><Trash2 />Delete project</KButton></template>
          </KAlertDialog>
        </div>
      </div>`,
  }),
}

export const OpenConfirmation: Story = {
  render: () => ({
    components: { KAlertDialog },
    template: `<KAlertDialog :open="true" title="Delete “Calm Mobile”?" description="This removes the project and its 24 files for everyone on your team." confirm-label="Delete project" />`,
  }),
}

export const GenericDialog: Story = {
  render: () => ({
    components: { KDialog, KButton },
    setup: () => ({ open: ref(false) }),
    template: `
      <KDialog v-model:open="open" title="Invite teammates" description="They will get an email with a link to join this workspace.">
        <template #trigger><KButton>Invite</KButton></template>
        <template #footer><KButton variant="secondary" @click="open = false">Close</KButton></template>
      </KDialog>`,
  }),
}
