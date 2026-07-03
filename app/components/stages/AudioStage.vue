<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Audio</h2>
      <p class="text-sm text-gray-500">Generate a voiceover from your script.</p>
    </div>

    <!-- Voice settings -->
    <div class="flex flex-col gap-5 p-5 rounded-xl border border-white/10 bg-white/3">
      <h3 class="text-sm font-medium text-gray-300">Voice settings</h3>

      <!-- Provider tabs -->
      <div class="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
        <button
          v-for="p in providers"
          :key="p.id"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          :class="settings.provider === p.id
            ? 'bg-white text-gray-950'
            : 'text-gray-400 hover:text-white'"
          @click="audioStage.setProvider(p.id as 'elevenlabs' | 'openai_tts')"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Voice grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <button
          v-for="voice in currentVoices"
          :key="voice.id"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left"
          :class="settings.voiceId === voice.id
            ? 'border-white/40 bg-white/8 text-white'
            : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'"
          @click="settings.voiceId = voice.id"
        >
          <span class="text-xs text-gray-600">
            {{ voice.gender === 'female' ? '♀' : voice.gender === 'male' ? '♂' : '◎' }}
          </span>
          {{ voice.name }}
        </button>
      </div>

      <!-- Sliders -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <label class="text-xs text-gray-400">Speed</label>
            <span class="text-xs text-gray-500">{{ settings.speed.toFixed(2) }}×</span>
          </div>
          <input v-model.number="settings.speed" type="range" min="0.5" max="2" step="0.05" class="accent-white w-full" />
        </div>

        <template v-if="settings.provider === 'elevenlabs'">
          <div class="flex flex-col gap-1.5">
            <div class="flex justify-between">
              <label class="text-xs text-gray-400">Stability</label>
              <span class="text-xs text-gray-500">{{ settings.stability.toFixed(2) }}</span>
            </div>
            <input v-model.number="settings.stability" type="range" min="0" max="1" step="0.05" class="accent-white w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="flex justify-between">
              <label class="text-xs text-gray-400">Clarity</label>
              <span class="text-xs text-gray-500">{{ settings.similarityBoost.toFixed(2) }}</span>
            </div>
            <input v-model.number="settings.similarityBoost" type="range" min="0" max="1" step="0.05" class="accent-white w-full" />
          </div>
        </template>
      </div>
    </div>

    <!-- Generate and upload controls -->
    <div class="flex items-center gap-4 flex-wrap">
      <div class="relative">
        <span
          v-if="audioMismatch"
          class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-400 z-10 pointer-events-none"
          data-testid="audio-mismatch-dot"
          title="Scene text or order has changed since this audio was generated"
        />
        <button
          :disabled="isGenerating || !scenes.length"
          class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
          @click="generate"
        >
          <span v-if="isGenerating" class="flex items-center gap-2">
            <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
            Generating audio… ({{ jobState.completed }}/{{ jobState.total }})
          </span>
          <span v-else>{{ audioUrl ? 'Regenerate audio' : 'Generate audio' }}</span>
        </button>
      </div>

      <input
        ref="audioInput"
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/x-wav"
        class="hidden"
        @change="onAudioFileChange"
      />
      <button
        :disabled="uploadingAudio || isGenerating"
        class="px-5 py-2 border border-white/15 text-gray-200 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-40"
        @click="audioInput?.click()"
      >
        <span v-if="uploadingAudio">Uploading audio...</span>
        <span v-else>{{ audioUrl ? 'Replace with upload' : 'Upload audio' }}</span>
      </button>

      <p v-if="generationError || uploadError" class="text-sm text-amber-400/80">
        {{ generationError ?? uploadError }}
      </p>
    </div>

    <!-- Audio player (shown when audio is available) -->
    <AudioPlayer
      v-if="audioUrl"
      :audio-url="audioUrl"
      :scenes="scenes"
      :scene-images="sceneImagesMap"
    />

    <!-- Continue -->
    <div class="pt-2">
      <button
        class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        @click="$emit('done')"
      >
        Continue to Video →
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ projectId: string }>()
defineEmits<{ done: [] }>()

const TAB_PROVIDERS = ['elevenlabs', 'openai_tts'] as const
const providers = [
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'openai_tts', label: 'OpenAI TTS' },
]

const projectStore = useProjectStore()
const audioStage = useAudioStage(toRef(props, 'projectId'))
const { settings, audioUrl, currentVoices } = audioStage

const { scenes, fetchScenes, recalcTimestamps, persistTimestamps } = useScenes(toRef(props, 'projectId'))

// Orange dot: current scene text/order/count differs from the snapshot captured
// when the voice_track was last combined. Audio isn't auto-regenerated on scene
// edits (it costs API calls), so this just surfaces staleness.
const audioMismatch = computed(() => {
  const snap = audioStage.generationSnapshot.value
  if (!snap || !audioUrl.value) return false
  const current = scenes.value.map(s => `${s.id}:${s.script_text}`).join('|')
  const generated = snap.map(s => `${s.id}:${s.script_text}`).join('|')
  return current !== generated
})

const audioInput = ref<HTMLInputElement | null>(null)
const uploadingAudio = ref(false)
const uploadError = ref<string | null>(null)
const generationError = ref<string | null>(null)

// Per-scene audio job tracking
const jobState = ref({ total: 0, completed: 0, failed: 0, pendingIds: [] as string[] })
const isGenerating = computed(() => jobState.value.pendingIds.length > 0 || jobState.value.total > 0 && jobState.value.completed + jobState.value.failed < jobState.value.total)

const sceneImagesMap = computed(() => new Map<string, string>())

onMounted(async () => {
  await Promise.all([fetchScenes(), audioStage.fetchExistingAudio()])
  const savedProvider = projectStore.settings?.default_audio_provider
  if (savedProvider && (TAB_PROVIDERS as readonly string[]).includes(savedProvider)) {
    audioStage.setProvider(savedProvider as 'elevenlabs' | 'openai_tts')
  }
})

onUnmounted(() => {
  if (pollTimer !== null) clearTimeout(pollTimer)
})

let pollTimer: ReturnType<typeof setTimeout> | null = null

async function pollAudioJobs() {
  if (!jobState.value.pendingIds.length) return

  const stillPending: string[] = []
  let newCompleted = 0
  let newFailed = 0

  await Promise.all(
    jobState.value.pendingIds.map(async (jobId) => {
      try {
        const j = await $fetch<{ status: string }>(`/api/jobs/${jobId}`)
        if (j.status === 'completed') {
          newCompleted++
        } else if (j.status === 'failed') {
          newFailed++
        } else {
          stillPending.push(jobId)
        }
      } catch {
        stillPending.push(jobId) // retry next poll
      }
    }),
  )

  jobState.value = {
    ...jobState.value,
    completed: jobState.value.completed + newCompleted,
    failed: jobState.value.failed + newFailed,
    pendingIds: stillPending,
  }

  if (stillPending.length > 0) {
    pollTimer = setTimeout(pollAudioJobs, 2000)
  } else {
    await onAllAudioJobsComplete()
  }
}

async function onAllAudioJobsComplete() {
  if (jobState.value.failed > 0) {
    generationError.value = `Audio generation failed for ${jobState.value.failed} scene(s).`
  }

  if (jobState.value.failed < jobState.value.total) {
    // At least some succeeded — combine per-scene audio into a single voice_track for the player
    try {
      await $fetch<{ url: string }>('/api/audio/combine', {
        method: 'POST',
        body: { projectId: props.projectId },
      })
      // Re-fetch rather than setAudioUrl() directly so the fresh scene_snapshot
      // (written by the combine step) comes down too and clears the mismatch dot.
      await audioStage.fetchExistingAudio()
    } catch {
      // Non-fatal: export still uses per-scene audio; player just won't show
    }

    // Fetch updated scene durations (worker wrote them) and recalculate timestamps
    await fetchScenes()
    const recalced = recalcTimestamps([...scenes.value])
    scenes.value = recalced
    await persistTimestamps(recalced)
  }

  jobState.value = { total: 0, completed: 0, failed: 0, pendingIds: [] }
}

async function generate() {
  if (isGenerating.value || !scenes.value.length) return

  generationError.value = null
  const provider = projectStore.settings?.default_audio_provider ?? settings.value.provider

  const commonInput = {
    voice_id: settings.value.voiceId,
    provider,
    speed: settings.value.speed,
    stability: settings.value.stability,
    similarity_boost: settings.value.similarityBoost,
  }

  // Fire one audio job per scene in parallel
  const results = await Promise.allSettled(
    [...scenes.value]
      .sort((a, b) => a.order_index - b.order_index)
      .map(scene =>
        $fetch<{ id: string }>('/api/jobs', {
          method: 'POST',
          body: {
            projectId: props.projectId,
            type: 'audio',
            input: {
              scene_id: scene.id,
              script_text: scene.script_text,
              ...commonInput,
            },
          },
        }),
      ),
  )

  const successIds = results
    .filter((r): r is PromiseFulfilledResult<{ id: string }> => r.status === 'fulfilled')
    .map(r => r.value.id)

  if (!successIds.length) {
    generationError.value = 'Failed to start audio generation.'
    return
  }

  const failedOnStart = results.filter(r => r.status === 'rejected').length
  jobState.value = {
    total: results.length,
    completed: 0,
    failed: failedOnStart,
    pendingIds: successIds,
  }

  pollTimer = setTimeout(pollAudioJobs, 2000)
}

async function onAudioFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploadingAudio.value = true
  uploadError.value = null
  try {
    const formData = new FormData()
    formData.append('projectId', props.projectId)
    formData.append('type', 'audio')
    formData.append('file', file)

    const result = await $fetch<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      body: formData,
    })

    audioStage.setAudioUrl(result.url)

    // Detect total audio duration, then redistribute scene durations proportionally
    await redistributeSceneDurations(result.url)
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Audio upload failed.'
  } finally {
    uploadingAudio.value = false
  }
}

function detectAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.src = url
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true })
    audio.addEventListener('error', () => resolve(0), { once: true })
    // Resolve with 0 after 10s so we never hang
    setTimeout(() => resolve(0), 10_000)
  })
}

async function redistributeSceneDurations(audioUrl: string) {
  if (!scenes.value.length) return
  const audioDuration = await detectAudioDuration(audioUrl)
  if (!audioDuration) return

  const currentTotal = scenes.value.reduce((sum, s) => sum + (s.duration ?? 5), 0)
  if (currentTotal <= 0) return

  const ratio = audioDuration / currentTotal
  const updated = scenes.value.map(s => ({
    ...s,
    duration: Math.max(0.5, (s.duration ?? 5) * ratio),
  }))
  const recalced = recalcTimestamps(updated)
  scenes.value = recalced
  await persistTimestamps(recalced)
}
</script>
