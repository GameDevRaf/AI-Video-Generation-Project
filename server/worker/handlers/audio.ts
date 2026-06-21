import { updateJobStatus } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

// Placeholder — implement with ElevenLabs, OpenAI TTS, etc.
export async function handleAudioJob(job: DbJob) {
  const input = job.input as { script_text: string; voice_id?: string; provider?: string }
  console.log(`[audio] Job ${job.id} — provider: ${input.provider ?? 'none configured'}`)

  await updateJobStatus(job.id, 'failed', {
    error_message: 'Audio provider not yet configured. Add your provider in server/worker/handlers/audio.ts',
  })
}
