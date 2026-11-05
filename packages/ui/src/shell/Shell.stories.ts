import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Activity, BarChart3, Globe, KeyRound, LayoutDashboard, Mail, Settings } from '@lucide/vue'
import { ref } from 'vue'

import KButton from '../components/KButton.vue'
import KNavItem from '../components/KNavItem.vue'
import KAppShell from './KAppShell.vue'
import KBreadcrumbs from './KBreadcrumbs.vue'
import KSidebar from './KSidebar.vue'
import KSidebarSection from './KSidebarSection.vue'
import KTabs from './KTabs.vue'
import KToaster from './KToaster.vue'
import KTooltip from './KTooltip.vue'
import KTopbar from './KTopbar.vue'
import { useToast } from './useToast'

const meta = {
  title: 'Organisms/App shell',
  component: KAppShell,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof KAppShell>

export default meta
type Story = StoryObj<typeof meta>

/** Sidebar on wide screens; a drawer opened from the topbar menu button on phones. */
export const Dashboard: Story = {
  render: () => ({
    components: { KAppShell, KSidebar, KSidebarSection, KNavItem, KTopbar, KBreadcrumbs, KButton },
    setup() {
      const open = ref(false)
      const current = ref('Domains')
      const groups = [
        { title: '', items: [{ label: 'Overview', icon: LayoutDashboard }] },
        {
          title: 'Send',
          items: [
            { label: 'Emails', icon: Mail },
            { label: 'Domains', icon: Globe },
          ],
        },
        {
          title: 'Observe',
          items: [
            { label: 'Analytics', icon: BarChart3 },
            { label: 'Monitoring', icon: Activity },
          ],
        },
        {
          title: 'Configure',
          items: [
            { label: 'API keys', icon: KeyRound },
            { label: 'Settings', icon: Settings },
          ],
        },
      ]
      return { open, current, groups }
    },
    template: `
      <KAppShell v-model:sidebar-open="open">
        <template #sidebar>
          <KSidebar label="Dashboard">
            <template #header><span class="text-xl font-bold tracking-[0.04em]">dak<span class="font-medium text-primary">.khata</span></span></template>
            <KSidebarSection v-for="g in groups" :key="g.title" :title="g.title || undefined">
              <KNavItem v-for="i in g.items" :key="i.label" :icon="i.icon" :current="current === i.label" @click="current = i.label; open = false">{{ i.label }}</KNavItem>
            </KSidebarSection>
          </KSidebar>
        </template>
        <template #topbar>
          <KTopbar :title="current" @menu="open = true">
            <template #breadcrumbs><KBreadcrumbs :items="[{ label: 'Acme' , href: '#' }, { label: 'Production', href: '#' }, { label: current }]" /></template>
            <template #actions><KButton size="sm">Add domain</KButton></template>
          </KTopbar>
        </template>
        <p class="text-fg-muted">Page content goes here.</p>
      </KAppShell>`,
  }),
}

export const Tabs: Story = {
  render: () => ({
    components: { KTabs },
    template: `
      <div class="p-8">
        <KTabs label="Email detail" :items="[{ value: 'timeline', label: 'Timeline', count: 7 }, { value: 'content', label: 'Content' }, { value: 'webhooks', label: 'Webhooks', count: 2 }, { value: 'raw', label: 'Raw', disabled: true }]">
          <template #timeline><p>Accepted → rendered → queued → submitted → delivered</p></template>
          <template #content><p>Rendered HTML preview.</p></template>
          <template #webhooks><p>2 deliveries.</p></template>
        </KTabs>
      </div>`,
  }),
}

export const TooltipAndToast: Story = {
  render: () => ({
    components: { KTooltip, KToaster, KButton },
    setup() {
      const { toast } = useToast()
      return {
        show: (tone: 'neutral' | 'success' | 'warning' | 'danger') =>
          toast({
            title: `A ${tone} toast`,
            description: 'It closes on its own after 5 seconds.',
            tone,
          }),
      }
    },
    template: `
      <div class="flex flex-wrap gap-3 p-8">
        <KTooltip content="Copies the key to your clipboard"><KButton variant="outline" size="sm">Hover me</KButton></KTooltip>
        <KButton size="sm" @click="show('neutral')">Neutral</KButton>
        <KButton size="sm" variant="secondary" @click="show('success')">Success</KButton>
        <KButton size="sm" variant="secondary" @click="show('warning')">Warning</KButton>
        <KButton size="sm" variant="danger" @click="show('danger')">Danger</KButton>
        <KToaster />
      </div>`,
  }),
}
