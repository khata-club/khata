<script setup lang="ts">
import { KBadge, KLabel, KSelect } from '@khata/ui'
import { computed, useId } from 'vue'

import { useCurrent } from '@/lib/context'

const { projects, project, environment, selectProject, selectEnvironment } = useCurrent()
const id = useId()

const projectOptions = computed(
  () => projects.data.value?.map((p) => ({ value: p.id, label: p.name })) ?? [],
)
const envOptions = computed(
  () => project.value?.environments.map((e) => ({ value: e.id, label: e.name })) ?? [],
)
</script>

<template>
  <div v-if="projectOptions.length" class="flex flex-col gap-2 px-3 pb-2" data-testid="context">
    <KLabel :for="`${id}-project`" class="sr-only">Project</KLabel>
    <KSelect
      :id="`${id}-project`"
      :model-value="project?.id"
      :options="projectOptions"
      @update:model-value="(v) => v && selectProject(v)"
    />
    <div class="flex items-center gap-2">
      <KLabel :for="`${id}-env`" class="sr-only">Environment</KLabel>
      <KSelect
        :id="`${id}-env`"
        class="flex-1"
        :model-value="environment?.id"
        :options="envOptions"
        @update:model-value="(v) => v && selectEnvironment(v)"
      />
      <KBadge v-if="environment?.pausedAt" tone="danger">Paused</KBadge>
      <KBadge v-else-if="environment?.kind === 'sandbox'" tone="primary" :dot="false">Sink</KBadge>
      <KBadge v-else-if="environment && !environment.sendingEnabled" tone="warning">Off</KBadge>
    </div>
  </div>
</template>
