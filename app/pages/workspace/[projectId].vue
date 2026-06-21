<template>
  <NuxtLayout name="workspace" :project-name="project?.name">
    <!-- Top-right controls -->
    <template #model-selector>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 px-3 py-1 rounded-full border border-white/10">
          {{ currentStageLabel }}
        </span>
        <button
          class="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-full border border-white/10 hover:border-white/20 transition-colors"
          @click="providerPanelOpen = true"
        >
          API Keys
        </button>
      </div>
    </template>

    <!-- Stage content -->
    <div v-if="loading" class="flex items-center justify-center h-64 text-gray-500 text-sm">
      Loading project…
    </div>
    <div v-else-if="error" class="flex items-center justify-center h-64 text-red-400 text-sm">
      {{ error }}
    </div>
    <template v-else>
      <!-- Script stage — always visible as entry point -->
      <StagesScriptStage :project-id="projectId" @done="onScriptDone" />

      <!-- Scene split stage — appears after script is locked -->
      <div v-if="workspace.activeScriptText" class="border-t border-white/5">
        <StagesSceneSplitStage
          :project-id="projectId"
          :script-text="workspace.activeScriptText"
          @done="onSceneDone"
        />
      </div>

      <!-- Image stage — appears after scenes are confirmed -->
      <div v-if="showImageStage" class="border-t border-white/5">
        <StagesImageStage
          :project-id="projectId"
          :prompt-edit-mode="projectSettings?.prompt_edit_mode"
          @done="onImageDone"
        />
      </div>

      <!-- Audio stage -->
      <div v-if="showAudioStage" class="border-t border-white/5">
        <StagesAudioStage
          :project-id="projectId"
          :script-text="workspace.activeScriptText ?? ''"
          @done="onAudioDone"
        />
      </div>

      <!-- Video stage -->
      <div v-if="showVideoStage" class="border-t border-white/5">
        <StagesVideoStage
          :project-id="projectId"
          @done="onVideoDone"
        />
      </div>

      <!-- Export stage -->
      <div v-if="showExportStage" class="border-t border-white/5">
        <StagesExportStage :project-id="projectId" />
      </div>
    </template>

    <!-- Provider panel (Teleport to body internally) -->
    <WorkspaceProviderPanel :open="providerPanelOpen" @close="providerPanelOpen = false" />

    <!-- Bottom timeline (placeholder for Phase 6.2) -->
    <template #timeline>
      <div class="shrink-0 h-10 border-t border-white/8 bg-gray-950 flex items-center px-4 gap-3">
        <button class="text-gray-500 hover:text-white transition-colors" title="Play">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <div class="flex-1 h-0.5 bg-white/10 rounded-full">
          <div class="h-full bg-white/30 rounded-full" style="width: 0%" />
        </div>
        <span class="text-xs text-gray-600">0:00</span>
      </div>
    </template>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)
const workspace = useWorkspaceStore()
const projectStore = useProjectStore()
const jobsStore = useJobsStore()

const showImageStage = ref(false)
const showAudioStage = ref(false)
const showVideoStage = ref(false)
const showExportStage = ref(false)
const providerPanelOpen = ref(false)

// Aliases from store — workspace page reads these reactively
const project = computed(() => projectStore.currentProject)
const projectSettings = computed(() => projectStore.settings)
const loading = computed(() => projectStore.loading)
const error = computed(() => projectStore.error)

const stageLabels: Record<string, string> = {
  script: 'Script',
  scene_split: 'Scenes',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  export: 'Export',
}
const currentStageLabel = computed(() =>
  stageLabels[projectStore.currentStage] ?? 'Script'
)

onMounted(async () => {
  workspace.setProject(projectId.value)
  await projectStore.loadProject(projectId.value)
  // Restore visible stages from persisted project stage
  const stage = projectStore.currentStage
  if (['image', 'audio', 'video', 'export'].includes(stage)) showImageStage.value = true
  if (['audio', 'video', 'export'].includes(stage)) showAudioStage.value = true
  if (['video', 'export'].includes(stage)) showVideoStage.value = true
  if (stage === 'export') showExportStage.value = true
})

onUnmounted(() => {
  jobsStore.cancelAll()
  projectStore.reset()
})

function onScriptDone() {
  projectStore.setStage('scene_split')
}

function onSceneDone() {
  showImageStage.value = true
  projectStore.setStage('image')
}

function onImageDone() {
  showAudioStage.value = true
  projectStore.setStage('audio')
}

function onAudioDone() {
  showVideoStage.value = true
  projectStore.setStage('video')
}

function onVideoDone() {
  showExportStage.value = true
  projectStore.setStage('export')
}
</script>
