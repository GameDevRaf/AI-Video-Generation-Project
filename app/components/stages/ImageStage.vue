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

      <p v-if="promptsJob?.status === 'failed'" class="text-sm text-red-400">
        {{ promptsJob.error_message ?? 'Prompt generation failed.' }}
      </p>
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
        :generating="generatingSceneId === scene.id"
        :provider-error="imageProviderError"
        @save-prompt="imageStage.savePrompt"
        @generate-image="generateImage"
      />
    </div>

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

const { scenes, loading: scenesLoading, fetchScenes } = useScenes(toRef(props, 'projectId'))
const imageStage = useImageStage(toRef(props, 'projectId'))

const { job: promptsJob, isRunning: promptsRunning, startJob: startPromptsJob } = useJobPoller()

const generatingSceneId = ref<string | null>(null)
const imageProviderError = ref<string | undefined>(undefined)

const promptEditMode = computed(() => props.promptEditMode ?? 'after_generation')
const hasAnyPrompt = computed(() => imageStage.prompts.value.size > 0)

onMounted(async () => {
  await fetchScenes()
  await imageStage.fetchPrompts()
})

// After prompt job finishes, reload prompts from API
watch(promptsJob, async (j) => {
  if (j?.status === 'completed') {
    await imageStage.fetchPrompts()
  }
})

async function generateAllPrompts() {
  await startPromptsJob(props.projectId, 'image_prompt', {})
}

async function generateImage(sceneId: string, prompt: string) {
  generatingSceneId.value = sceneId
  imageProviderError.value = undefined
  const provider = projectStore.settings?.default_image_provider ?? undefined
  const model = projectStore.settings?.default_image_model ?? undefined
  try {
    const job = await $fetch<{ id: string; status: string; error_message?: string }>('/api/jobs', {
      method: 'POST',
      body: {
        projectId: props.projectId,
        type: 'image',
        input: {
          scene_id: sceneId,
          prompt,
          ...(provider ? { provider } : {}),
          ...(model ? { model } : {}),
        },
      },
    })
    if (job.status === 'failed' || job.error_message) {
      imageProviderError.value = job.error_message ?? 'Image provider not configured.'
    }
  } catch {
    imageProviderError.value = 'Failed to start image job.'
  } finally {
    generatingSceneId.value = null
  }
}
</script>
