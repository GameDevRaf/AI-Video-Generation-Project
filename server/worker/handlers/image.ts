import { updateJobStatus } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

// Placeholder — implement with your chosen image provider (fal.ai, DALL-E, Stability, etc.)
export async function handleImageJob(job: DbJob) {
  const input = job.input as { scene_id: string; prompt: string; provider?: string }
  console.log(`[image] Job ${job.id} — scene ${input.scene_id}, provider: ${input.provider ?? 'none configured'}`)

  await updateJobStatus(job.id, 'failed', {
    error_message: 'Image provider not yet configured. Add your provider in server/worker/handlers/image.ts',
  })
}
