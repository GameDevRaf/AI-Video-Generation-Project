<template>
  <NuxtLayout name="workspace" :project-name="project?.name">
    <!-- Stage tab bar (center slot) -->
    <template #tabs>
      <WorkspaceStageTabs
        :active-tab="activeTab"
        :current-stage="projectStore.currentStage"
        @update:active-tab="setTab"
      />
    </template>

    <!-- Model selector (right slot) — stage follows the active tab -->
    <template #model-selector>
      <div class="flex items-center gap-2">
        <WorkspaceModelSelector
          :stage="activeTab"
          :saved-provider-ids="savedProviderIds"
          :initial-provider-id="currentProviderId"
          :initial-model-id="currentModelId"
          @provider-changed="onProviderChanged"
          @open-key-panel="providerPanelOpen = true"
        />
        <button
          class="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-full border border-white/10 hover:border-white/20 transition-colors"
          @click="providerPanelOpen = true"
        >
          API Keys
        </button>
      </div>
    </template>

    <!-- Loading / error states -->
    <div v-if="loading || restoring" class="flex items-center justify-center h-full text-gray-500 text-sm">
      Loading project…
    </div>
    <div v-else-if="error" class="flex items-center justify-center h-full text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Tab content with directional slide transition -->
    <div v-else class="flex h-full flex-col gap-4">
      <div
        v-if="sceneOrderError"
        class="mx-8 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
      >
        {{ sceneOrderError }}
      </div>

      <div class="relative min-h-0 flex-1 overflow-hidden">
        <Transition :name="transitionName">
          <div :key="activeTab" class="tab-panel">
          <!-- Script tab: script generation + scene splitting -->
            <template v-if="activeTab === 'script'">
              <StagesScriptStage :project-id="projectId" @done="onScriptDone" />
              <div v-if="showSceneSplit" class="border-t border-white/5">
                <StagesSceneSplitStage
                  :project-id="projectId"
                  :script-text="workspace.activeScriptText ?? ''"
                  @done="onSceneDone"
                />
              </div>
            </template>

            <!-- Image tab -->
            <StagesImageStage
              v-else-if="activeTab === 'image'"
              :project-id="projectId"
              :prompt-edit-mode="projectSettings?.prompt_edit_mode"
              @done="onImageDone"
            />

            <!-- Audio tab -->
            <StagesAudioStage
              v-else-if="activeTab === 'audio'"
              :project-id="projectId"
              @done="onAudioDone"
            />

            <!-- Video tab: video generation + export when reached -->
            <template v-else-if="activeTab === 'video'">
              <StagesVideoStage :project-id="projectId" @done="onVideoDone" />
              <div v-if="showExport" ref="exportSection" class="border-t border-white/5">
                <StagesExportStage :project-id="projectId" />
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Provider panel (teleports to body internally) -->
    <WorkspaceProviderPanel :open="providerPanelOpen" @close="providerPanelOpen = false" />

    <!-- Bottom timeline placeholder -->
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
import type { TabId } from '~/components/workspace/StageTabs.vue'

definePageMeta({ layout: false, middleware: 'auth' })

const TABS: TabId[] = ['script', 'image', 'audio', 'video']

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)
const workspace = useWorkspaceStore()
const projectStore = useProjectStore()
const jobsStore = useJobsStore()
const notifications = useNotificationsStore()
const sceneOrderSync = useSceneOrderSync(projectId)

const providerPanelOpen = ref(false)
const restoring = ref(true)
const activeTab = ref<TabId>('script')
const slideDirection = ref<'left' | 'right'>('left')
const exportSection = ref<HTMLElement | null>(null)
const sceneOrderError = ref<string | null>(null)

const project = computed(() => projectStore.currentProject)
const projectSettings = computed(() => projectStore.settings)
const loading = computed(() => projectStore.loading)
const error = computed(() => projectStore.error)

const transitionName = computed(() => `slide-${slideDirection.value}`)

// SceneSplitStage is shown in the Script tab once a script has been locked in
const showSceneSplit = computed(() =>
  ['scene_split', 'image', 'audio', 'video', 'export'].includes(projectStore.currentStage),
)

// ExportStage appears inside the Video tab after video generation is done
const showExport = computed(() => projectStore.currentStage === 'export')

function stageToTab(stage: string): TabId {
  if (stage === 'image') return 'image'
  if (stage === 'audio') return 'audio'
  if (stage === 'video' || stage === 'export') return 'video'
  return 'script'
}

async function setTab(tab: TabId) {
  if (tab === activeTab.value) return true

  sceneOrderError.value = null
  if (activeTab.value === 'script' && tab !== 'script') {
    try {
      await sceneOrderSync.flushPendingReorder()
    } catch (error) {
      sceneOrderError.value = error instanceof Error
        ? error.message
        : 'Failed to apply the new scene order before switching tabs.'
      return false
    }
  }

  // Switching tabs unmounts the current stage; drop any of its failure toasts.
  notifications.clear()

  const currentIdx = TABS.indexOf(activeTab.value)
  const nextIdx = TABS.indexOf(tab)
  slideDirection.value = nextIdx >= currentIdx ? 'left' : 'right'
  activeTab.value = tab
  return true
}

// Provider selector — follows the active tab, not the DB project stage
const savedProviderIds = ref<string[]>([])

const STAGE_PROVIDER_FIELD: Record<string, string> = {
  script: 'default_script_provider',
  image:  'default_image_provider',
  audio:  'default_audio_provider',
  video:  'default_video_provider',
}

const currentProviderId = computed(() => {
  const field = STAGE_PROVIDER_FIELD[activeTab.value]
  return field
    ? (projectSettings.value as Record<string, string | null> | null)?.[field] ?? undefined
    : undefined
})

const currentModelId = computed(() => {
  const field = `default_${activeTab.value}_model`
  return (projectSettings.value as Record<string, string | null> | null)?.[field] ?? undefined
})

async function onProviderChanged(providerId: string, modelId: string) {
  const tab = activeTab.value
  const field = STAGE_PROVIDER_FIELD[tab]
  if (!field) return
  await projectStore.updateSettings({
    [field]: providerId,
    [`default_${tab}_model`]: modelId,
  } as Parameters<typeof projectStore.updateSettings>[0])
}

onMounted(async () => {
  workspace.setProject(projectId.value)
  await projectStore.loadProject(projectId.value)

  const stage = projectStore.currentStage

  // Restore the script text that was locked in during scene splitting.
  // AudioStage needs it for voiceover generation; SceneSplitStage needs it for display.
  if (stage !== 'script') {
    try {
      const { text } = await $fetch<{ text: string | null }>('/api/script', {
        query: { projectId: projectId.value },
      })
      if (text) workspace.setActiveScript(text)
    } catch { /* non-fatal — script tab will still work, audio will send empty string */ }
  }

  // Open to the tab matching the project's last-saved stage
  activeTab.value = stageToTab(stage)

  // Load which providers have saved API keys (for ModelSelector badges)
  const keys = await $fetch<{ provider: string }[]>('/api/provider/keys').catch(() => [])
  savedProviderIds.value = [...new Set(keys.map(k => k.provider))]

  restoring.value = false
})

onBeforeRouteLeave(async () => {
  sceneOrderError.value = null
  try {
    await sceneOrderSync.flushPendingReorder()
  } catch (error) {
    sceneOrderError.value = error instanceof Error
      ? error.message
      : 'Failed to apply the new scene order before leaving the project.'
    return false
  }
})

onUnmounted(() => {
  jobsStore.cancelAll()
  projectStore.reset()
  notifications.clear()
})

// Stage progression handlers — advance DB stage and switch to the next tab

function onScriptDone() {
  // Script locked; SceneSplitStage becomes visible in the Script tab
  projectStore.setStage('scene_split')
}

async function onSceneDone() {
  const switched = await setTab('image')
  if (!switched) return
  await projectStore.setStage('image')
}

async function onImageDone() {
  await projectStore.setStage('audio')
  await setTab('audio')
}

async function onAudioDone() {
  await projectStore.setStage('video')
  await setTab('video')
}

function onVideoDone() {
  // Export appears below VideoStage in the same tab
  projectStore.setStage('export')
  nextTick(() => {
    exportSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
</script>

<style>
/* Directional slide transitions for tab switching.
   .tab-panel is always position:absolute so both entering/leaving overlap during the animation. */
.tab-panel {
  position: absolute;
  inset: 0;
  overflow-y: auto;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease;
}

/* Entering tab sits on top of the leaving one */
.slide-left-enter-active,
.slide-right-enter-active {
  z-index: 1;
}

/* Forward (Script → Image → Audio → Video): enter from right, leave to left */
.slide-left-enter-from { transform: translateX(28px); opacity: 0; }
.slide-left-leave-to   { transform: translateX(-28px); opacity: 0; }

/* Backward (Video → Audio → Image → Script): enter from left, leave to right */
.slide-right-enter-from { transform: translateX(-28px); opacity: 0; }
.slide-right-leave-to   { transform: translateX(28px); opacity: 0; }
</style>
