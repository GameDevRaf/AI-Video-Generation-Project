<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">Images</h2>
        <p class="text-sm text-gray-500">Generate a first-frame image for each scene.</p>
      </div>

      <!-- Prompt edit mode badge -->
      <span class="text-xs px-2.5 py-1 rounded-full border border-white/10 text-gray-500">
        {{ promptEditMode === 'before_generation' ? 'Edit prompts first' : 'Generate then edit' }}
      </span>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-3 flex-wrap">
      <button
        :disabled="promptsRunning || !scenes.length"
        class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
        @click="generateAllPrompts"
      >
        <span v-if="promptsRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
          Generating prompts…
        </span>
        <span v-else>{{ hasAnyPrompt ? 'Regenerate all prompts' : 'Generate all prompts' }}</span>
      </button>

      <!-- Generate all images -->
      <button
        :disabled="generatingAllImages || imageJobRunning || !hasAnyPrompt || !scenes.length"
        class="px-5 py-2 border border-white/15 text-gray-200 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-40"
        @click="generateAllImages"
      >
        <span v-if="generatingAllImages || imageJobRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Generating images…
        </span>
        <span v-else>{{ hasAnyImage ? 'Regenerate all images' : 'Generate all images' }}</span>
      </button>

      <p v-if="promptsJob?.status === 'failed'" class="text-sm text-red-400">
        {{ promptsJob.error_message ?? 'Prompt generation failed.' }}
      </p>
      <p v-if="allImagesError" class="text-sm text-amber-400/80">{{ allImagesError }}</p>
    </div>

    <!-- Scene grid -->
    <div v-if="scenesLoading" class="text-sm text-gray-500">Loading scenes…</div>
    <div v-else-if="!scenes.length" class="text-sm text-gray-500">No scenes found. Go back and split your script first.</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <StagesImageSceneCard
        v-for="scene in scenes"
        :key="scene.id"
        :scene="scene"
        :prompt="imageStage.getPrompt(scene)"
        :has-prompt="imageStage.hasPrompt(scene)"
        :image-url="imageStage.getImage(scene)"
        :generation-prompt="imageStage.getGenerationPrompt(scene)"
        :data-loaded="dataLoaded"
        :generating="generatingSceneId === scene.id"
        :generating-prompt="promptsRunning || singlePromptRunning && regeneratingPromptSceneId === scene.id"
        :uploading="uploadingSceneId === scene.id"
        :provider-error="imageProviderError"
        @save-prompt="imageStage.savePrompt"
        @generate-image="generateImage"
        @regenerate-prompt="generateSinglePrompt"
        @upload-image="uploadImage"
        @view-image="openPreview"
      />
    </div>

    <MediaPreviewModal
      v-if="previewUrl"
      :open="!!previewUrl"
      :url="previewUrl"
      type="image"
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
        Continue to Audio →
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  projectId: string
  promptEditMode?: string
}>()
defineEmits<{ done: [] }>()

const projectStore = useProjectStore()
const jobsStore = useJobsStore()

const { scenes, loading: scenesLoading, fetchScenes } = useScenes(toRef(props, 'projectId'))
const imageStage = useImageStage(toRef(props, 'projectId'))

const { job: promptsJob, isRunning: promptsRunning, startJob: startPromptsJob } = useJobPoller()
const { job: singlePromptJob, isRunning: singlePromptRunning, startJob: startSinglePromptJob } = useJobPoller()
const { job: imageJob, isRunning: imageJobRunning, startJob: startImageJob } = useJobPoller()

const generatingSceneId = ref<string | null>(null)
const generatingAllImages = ref(false)
const regeneratingPromptSceneId = ref<string | null>(null)
const uploadingSceneId = ref<string | null>(null)
const imageProviderError = ref<string | undefined>(undefined)
const allImagesError = ref<string | undefined>(undefined)
const previewSceneId = ref<string | null>(null)
const dataLoaded = ref(false)

const promptEditMode = computed(() => props.promptEditMode ?? 'after_generation')
const hasAnyPrompt = computed(() => imageStage.prompts.value.size > 0)
const hasAnyImage = computed(() => imageStage.images.value.size > 0)

onMounted(async () => {
  await fetchScenes()
  await Promise.all([imageStage.fetchPrompts(), imageStage.fetchImages()])
  dataLoaded.value = true
})

// After bulk prompt job finishes, reload prompts
watch(promptsJob, async (j) => {
  if (j?.status === 'completed') {
    await imageStage.fetchPrompts()
  }
})

// After single-scene prompt job finishes, reload prompts and clear loading state
watch(singlePromptJob, async (j) => {
  if (j?.status === 'completed') {
    await imageStage.fetchPrompts()
    regeneratingPromptSceneId.value = null
  } else if (j?.status === 'failed') {
    regeneratingPromptSceneId.value = null
  }
})

// After a single image job finishes, reload images and clear the loading state
watch(imageJob, async (j) => {
  if (j?.status === 'completed') {
    await imageStage.fetchImages()
    generatingSceneId.value = null
  } else if (j?.status === 'failed') {
    imageProviderError.value = j.error_message ?? 'Image generation failed.'
    generatingSceneId.value = null
  }
})

async function generateAllPrompts() {
  await startPromptsJob(props.projectId, 'image_prompt', {})
}

async function generateSinglePrompt(sceneId: string) {
  regeneratingPromptSceneId.value = sceneId
  await startSinglePromptJob(props.projectId, 'image_prompt', { scene_id: sceneId })
}

async function generateImage(sceneId: string, prompt: string) {
  generatingSceneId.value = sceneId
  imageProviderError.value = undefined
  const provider = projectStore.settings?.default_image_provider ?? undefined
  const model = projectStore.settings?.default_image_model ?? undefined
  try {
    await startImageJob(props.projectId, 'image', {
      scene_id: sceneId,
      prompt,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    })
    // generatingSceneId is cleared by the imageJob watcher once status is terminal
  } catch {
    imageProviderError.value = 'Failed to start image job.'
    generatingSceneId.value = null
  }
}

async function generateAllImages() {
  if (generatingAllImages.value) return
  const targets = scenes.value.filter(s => imageStage.hasPrompt(s))
  if (!targets.length) return

  generatingAllImages.value = true
  allImagesError.value = undefined
  const provider = projectStore.settings?.default_image_provider ?? undefined
  const model = projectStore.settings?.default_image_model ?? undefined

  // Track each submitted job until it reaches a terminal state — a bare POST /api/jobs
  // only confirms the job was queued, not that generation finished, so the button must
  // stay disabled/loading and previews must refresh as each job actually completes.
  let remaining = targets.length
  let hadFailure = false
  function settleOne(failed: boolean) {
    if (failed) hadFailure = true
    remaining -= 1
    if (remaining === 0) {
      generatingAllImages.value = false
      if (hadFailure) allImagesError.value = 'Some images failed to generate.'
    }
  }

  await Promise.all(targets.map(async (s) => {
    try {
      const job = await jobsStore.createJob(props.projectId, 'image', {
        scene_id: s.id,
        prompt: imageStage.getPrompt(s),
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
      })
      jobsStore.startPolling(job.id, (finishedJob) => {
        const failed = finishedJob.status !== 'completed'
        const refreshed = failed ? Promise.resolve() : imageStage.fetchImages().catch(() => {})
        refreshed.then(() => settleOne(failed))
      })
    } catch {
      settleOne(true)
    }
  }))
}

async function uploadImage(sceneId: string, file: File) {
  uploadingSceneId.value = sceneId
  imageProviderError.value = undefined
  try {
    const formData = new FormData()
    formData.append('projectId', props.projectId)
    formData.append('sceneId', sceneId)
    formData.append('type', 'image')
    formData.append('file', file)

    await $fetch('/api/uploads/media', {
      method: 'POST',
      body: formData,
    })
    await imageStage.fetchImages()
  } catch (error) {
    imageProviderError.value = error instanceof Error ? error.message : 'Image upload failed.'
  } finally {
    uploadingSceneId.value = null
  }
}

const previewUrl = computed(() => {
  if (!previewSceneId.value) return null
  return imageStage.images.value.get(previewSceneId.value) ?? null
})

const previewTitle = computed(() => {
  const scene = scenes.value.find(s => s.id === previewSceneId.value)
  return scene ? `Scene ${scene.order_index + 1}${scene.title ? ` - ${scene.title}` : ''}` : 'Scene image'
})

const previewDownloadName = computed(() => `${previewTitle.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`)

function openPreview(sceneId: string) {
  previewSceneId.value = sceneId
}

function closePreview() {
  previewSceneId.value = null
}
</script>
