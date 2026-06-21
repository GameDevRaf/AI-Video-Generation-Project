import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeFileOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

export async function handleAudioJob(job: DbJob) {
  const input = job.input as {
    script_text: string
    voice_id?: string
    provider?: string
    model?: string
    speed?: number
  }

  const providerId = input.provider ?? job.provider ?? 'elevenlabs'
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'eleven_multilingual_v2'

  // Default voice IDs per provider
  const DEFAULT_VOICES: Record<string, string> = {
    elevenlabs: 'EXAVITQu4vr4xnSDxMaL',  // Sarah
    openai_tts: 'onyx',
    playht: 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json',
    cartesia: '694f9389-aac1-45b6-b726-9d9369183238',  // Barbershop Man
    fish_audio: '',   // Voice set via reference_id; omit for Fish Audio default
    gemini_tts: 'Kore',  // One of 30 built-in Gemini TTS voices
    huggingface_audio: '',  // No voice ID concept for HF models
  }

  const voiceId = input.voice_id ?? DEFAULT_VOICES[providerId] ?? ''

  await updateJobStatus(job.id, 'waiting_on_provider', {})

  const apiKey = await getProviderKey(meta?.keyProviderId ?? providerId, job.user_id)
  const provider = providerRegistry.audio(providerId)

  const { audioBuffer, mimeType } = await provider.generate({
    job,
    apiKey,
    model,
    text: input.script_text,
    voiceId,
    speed: input.speed,
  })

  const ext = mimeType === 'audio/wav' ? 'wav' : 'mp3'
  const storagePath = `${job.project_id}/audio/${job.id}_${Date.now()}.${ext}`

  await storeFileOutput(job, audioBuffer, storagePath, 'audio', 'voice_track', mimeType)

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { provider: providerId, model, voice_id: voiceId },
  })
}
