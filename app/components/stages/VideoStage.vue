<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Video</h2>
      <p class="text-sm text-gray-500">Generate a video clip for each scene, then review them in sequence.</p>
    </div>

    <!-- Controls row -->
    <div class="flex items-center gap-3 flex-wrap">
      <!-- Generate all prompts -->
      <button
        :disabled="promptsRunning || !scenes.length"
        class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
        @click="generateAllPrompts"
      >
        <span v-if="promptsRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
          Generating prompts…
        </span>
        <span v-else>{{ videoStage.hasAnyPrompt.value ? 'Regenerate prompts' : 'Generate motion prompts' }}</span>
      </button>

      <!-- Generate all videos -->
      <button
        :disabled="generatingAllVideos || videosRunning || !videoStage.hasAnyPrompt.value || !scenes.length"
        class="px-5 py-2 border border-white/15 text-gray-200 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-40"
        @click="generateAllVideos"
      >
        <span v-if="generatingAllVideos || videosRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Generating videos…
        </span>
        <span v-else>{{ videoStage.hasAnyVideo.value ? 'Regenerate all videos' : 'Generate all videos' }}</span>
      </button>

      <p v-if="promptsError || videosError" class="text-sm text-amber-400/80">
        {{ promptsError ?? videosError }}
      </p>
    </div>

    <!-- Storyboard timeline (shown when any video exists) -->
    <div v-if="videoStage.hasAnyVideo.value" class="flex flex-col gap-2">
      <p class="text-xs text-gray-500 uppercase tracking-wider font-medium">Timeline</p>
      <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          v-for="scene in scenes"
          :key="scene.id"
          class="shrink-0 flex flex-col gap-1 items-center cursor-pointer"
          @click="activeSceneId = scene.id"
        >
          <div
            class="w-24 aspect-video rounded-md overflow-hidden border transition-colors"
            :class="activeSceneId === scene.id ? 'border-white/50' : 'border-white/10'"
          >
            <video
              v-if="videoStage.getVideo(scene.id)"
              :src="videoStage.getVideo(scene.id)!"
              class="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div v-else class="w-full h-full bg-white/5 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
          <span class="text-xs text-gray-600">{{ scene.order_index + 1 }}</span>
        </button>
      </div>
    </div>

    <!-- Scene cards grid -->
    <div v-if="scenesLoading" class="text-sm text-gray-500">Loading scenes…</div>
    <div v-else-if="!scenes.length" class="text-sm text-gray-500">No scenes found. Go back and split your script first.</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <StagesVideoSceneCard
        v-for="scene in scenes"
        :key="scene.id"
        :scene="scene"
        :prompt="videoStage.getPrompt(scene.id)"
        :video-url="videoStage.getVideo(scene.id)"
        :image-url="imageStage.getImage(scene)"
        :generation-prompt="videoStage.getGenerationPrompt(scene.id)"
        :data-loaded="dataLoaded"
        :is-active="activeSceneId === scene.id"
        :generating="generatingSceneId === scene.id"
        :generating-prompt="singlePromptRunning && regeneratingPromptSceneId === scene.id"
        :uploading="uploadingSceneId === scene.id"
        :provider-error="generatingSceneId === scene.id || uploadingSceneId === scene.id ? providerError : undefined"
        @save-prompt="videoStage.savePrompt"
        @generate-video="generateSingleVideo"
        @regenerate-prompt="generateSinglePrompt"
        @upload-video="uploadVideo"
        @view-video="openPreview"
        @select="activeSceneId = $event"
      />
    </div>

    <MediaPreviewModal
      v-if="previewUrl"
      :open="!!previewUrl"
      :url="previewUrl"
      type="video"
      :title="previewTitle"
      :download-name="previewDownloadName"
      @close="closePreview"
    />

    <!-- Continue -->
    <div v-if="scenes.length" class="pt-2">
      <button
        class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        @click="$emit('done')"
      >
        Continue to Export →
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ projectId: string }>()
defineEmits<{ done: [] }>()

const projectStore = useProjectStore()

const { scenes, loading: scenesLoading, fetchScenes } = useScenes(toRef(props, 'projectId'))
const videoStage = useVideoStage(toRef(props, 'projectId'))
const imageStage = useImageStage(toRef(props, 'projectId'))

const { job: promptsJob, isRunning: promptsRunning, error: promptsError, startJob: startPromptsJob } = useJobPoller()
const { job: singlePromptJob, isRunning: singlePromptRunning, startJob: startSinglePromptJob } = useJobPoller()
const { job: videoJob, isRunning: videosRunning, error: videosError, startJob: startVideoJob } = useJobPoller()

const activeSceneId = ref<string | null>(null)
const generatingSceneId = ref<string | null>(null)
const generatingAllVideos = ref(false)
const regeneratingPromptSceneId = ref<string | null>(null)
const uploadingSceneId = ref<string | null>(null)
const providerError = ref<string | undefined>(undefined)
const previewSceneId = ref<string | null>(null)
const dataLoaded = ref(false)

onMounted(async () => {
  await fetchScenes()
  await Promise.all([videoStage.fetchPrompts(), videoStage.fetchVideos(), imageStage.fetchImages()])
  if (scenes.value.length) activeSceneId.value = scenes.value[0]?.id ?? null
  dataLoaded.value = true
})

watch(promptsJob, async (j) => {
  if (j?.status === 'completed') await videoStage.fetchPrompts()
})

watch(singlePromptJob, async (j) => {
  if (j?.status === 'completed') {
    await videoStage.fetchPrompts()
    regeneratingPromptSceneId.value = null
  } else if (j?.status === 'failed') {
    regeneratingPromptSceneId.value = null
  }
})

// After a single video job finishes, reload videos and clear the loading state
watch(videoJob, async (j) => {
  if (j?.status === 'completed') {
    await videoStage.fetchVideos()
    generatingSceneId.value = null
  } else if (j?.status === 'failed') {
    providerError.value = j.error_message ?? 'Video generation failed.'
    generatingSceneId.value = null
  }
})

async function generateAllPrompts() {
  await startPromptsJob(props.projectId, 'video_prompt', {})
}

async function generateSinglePrompt(sceneId: string) {
  regeneratingPromptSceneId.value = sceneId
  await startSinglePromptJob(props.projectId, 'video_prompt', { scene_id: sceneId })
}

async function generateAllVideos() {
  if (generatingAllVideos.value) return
  generatingAllVideos.value = true
  // Fire all video jobs in parallel (each takes 60–120 s; sequential would be too slow).
  // Server-side dedup returns any already-queued job instead of creating a duplicate.
  const provider = projectStore.settings?.default_video_provider ?? undefined
  const model = projectStore.settings?.default_video_model ?? undefined
  try {
    await Promise.all(
      scenes.value
        .filter(s => videoStage.getPrompt(s.id))
        .map(s => {
          const imageUrl = imageStage.getImage(s) ?? undefined
          const duration = s.duration ?? undefined
          return $fetch('/api/jobs', {
            method: 'POST',
            body: {
              projectId: props.projectId,
              type: 'video',
              input: {
                scene_id: s.id,
                prompt: videoStage.getPrompt(s.id),
                ...(imageUrl ? { image_url: imageUrl } : {}),
                ...(duration !== undefined ? { duration } : {}),
                ...(provider ? { provider } : {}),
                ...(model ? { model } : {}),
              },
            },
          }).catch(() => null)
        }),
    )
    await videoStage.fetchVideos()
  } finally {
    generatingAllVideos.value = false
  }
}

async function generateSingleVideo(sceneId: string, prompt: string) {
  generatingSceneId.value = sceneId
  providerError.value = undefined
  const provider = projectStore.settings?.default_video_provider ?? undefined
  const model = projectStore.settings?.default_video_model ?? undefined
  const scene = scenes.value.find(s => s.id === sceneId)
  const imageUrl = scene ? (imageStage.getImage(scene) ?? undefined) : undefined
  const duration = scene?.duration ?? undefined
  try {
    await startVideoJob(props.projectId, 'video', {
      scene_id: sceneId,
      prompt,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    })
    // generatingSceneId is cleared by the videoJob watcher once status is terminal
  } catch {
    providerError.value = 'Failed to start video job.'
    generatingSceneId.value = null
  }
}

async function uploadVideo(sceneId: string, file: File) {
  uploadingSceneId.value = sceneId
  providerError.value = undefined
  try {
    const formData = new FormData()
    formData.append('projectId', props.projectId)
    formData.append('sceneId', sceneId)
    formData.append('type', 'video')
    formData.append('file', file)

    await $fetch('/api/uploads/media', {
      method: 'POST',
      body: formData,
    })
    await videoStage.fetchVideos()
    activeSceneId.value = sceneId
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : 'Video upload failed.'
  } finally {
    uploadingSceneId.value = null
  }
}

const previewUrl = computed(() => {
  if (!previewSceneId.value) return null
  return videoStage.videos.value.get(previewSceneId.value) ?? null
})

const previewTitle = computed(() => {
  const scene = scenes.value.find(s => s.id === previewSceneId.value)
  return scene ? `Scene ${scene.order_index + 1}${scene.title ? ` - ${scene.title}` : ''}` : 'Scene video'
})

const previewDownloadName = computed(() => `${previewTitle.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp4`)

function openPreview(sceneId: string) {
  previewSceneId.value = sceneId
}

function closePreview() {
  previewSceneId.value = null
}
</script>
