// Static voice catalogue for common providers.
// Replace with dynamic API calls once provider accounts are connected.

export interface VoiceOption {
  id: string
  name: string
  gender: 'male' | 'female' | 'neutral'
  preview?: string
}

export interface AudioSettings {
  provider: 'elevenlabs' | 'openai'
  voiceId: string
  speed: number
  stability: number     // ElevenLabs only
  similarityBoost: number  // ElevenLabs only
}

export const VOICES: Record<AudioSettings['provider'], VoiceOption[]> = {
  elevenlabs: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'female' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'male' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'neutral' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy', gender: 'neutral' },
    { id: 'echo', name: 'Echo', gender: 'male' },
    { id: 'fable', name: 'Fable', gender: 'neutral' },
    { id: 'onyx', name: 'Onyx', gender: 'male' },
    { id: 'nova', name: 'Nova', gender: 'female' },
    { id: 'shimmer', name: 'Shimmer', gender: 'female' },
  ],
}

export function useAudioStage(projectId: MaybeRef<string>) {
  const settings = ref<AudioSettings>({
    provider: 'elevenlabs',
    voiceId: VOICES.elevenlabs[0].id,
    speed: 1.0,
    stability: 0.5,
    similarityBoost: 0.75,
  })

  const audioUrl = ref<string | null>(null)
  const loading = ref(false)

  async function fetchExistingAudio() {
    loading.value = true
    try {
      const data = await $fetch<{ url: string; jobInput: unknown } | null>('/api/audio', {
        query: { projectId: toValue(projectId) },
      })
      if (data?.url) audioUrl.value = data.url
    } finally {
      loading.value = false
    }
  }

  function setAudioUrl(url: string) {
    audioUrl.value = url
  }

  const currentVoices = computed(() => VOICES[settings.value.provider])

  function setProvider(p: AudioSettings['provider']) {
    settings.value.provider = p
    settings.value.voiceId = VOICES[p][0].id
  }

  return {
    settings,
    audioUrl,
    loading,
    currentVoices,
    fetchExistingAudio,
    setAudioUrl,
    setProvider,
  }
}
