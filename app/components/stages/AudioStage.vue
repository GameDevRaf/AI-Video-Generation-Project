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

    <!-- Generate button -->
    <div class="flex items-center gap-4 flex-wrap">
      <button
        :disabled="isRunning || !fullScriptText"
        class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
        @click="generate"
      >
        <span v-if="isRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
          Generating audio…
        </span>
        <span v-else>{{ audioUrl ? 'Regenerate audio' : 'Generate audio' }}</span>
      </button>

      <p v-if="jobError || (job?.status === 'failed')" class="text-sm text-amber-400/80">
        {{ job?.error_message ?? jobError ?? 'Audio generation failed.' }}
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

const { scenes, fetchScenes } = useScenes(toRef(props, 'projectId'))
const { job, isRunning, error: jobError, startJob } = useJobPoller()

// Derive the voiceover text from each scene's script_text (spoken words only).
// Using scenes as the source of truth is safer than the raw full script, because
// the scene-split step extracts just the spoken words per scene.
const fullScriptText = computed(() =>
  [...scenes.value]
    .sort((a, b) => a.order_index - b.order_index)
    .map(s => s.script_text)
    .join('\n\n'),
)

const sceneImagesMap = computed(() => new Map<string, string>())

onMounted(async () => {
  await Promise.all([fetchScenes(), audioStage.fetchExistingAudio()])
  const savedProvider = projectStore.settings?.default_audio_provider
  if (savedProvider && (TAB_PROVIDERS as readonly string[]).includes(savedProvider)) {
    audioStage.setProvider(savedProvider as 'elevenlabs' | 'openai_tts')
  }
})

watch(job, async (j) => {
  if (j?.status === 'completed') {
    await audioStage.fetchExistingAudio()
  }
})

async function generate() {
  const provider = projectStore.settings?.default_audio_provider ?? settings.value.provider
  await startJob(props.projectId, 'audio', {
    script_text: fullScriptText.value,
    voice_id: settings.value.voiceId,
    provider,
    speed: settings.value.speed,
    stability: settings.value.stability,
    similarity_boost: settings.value.similarityBoost,
  })
}
</script>
