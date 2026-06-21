import { updateJobStatus } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

// Placeholder — implement with Runway, Kling, etc.
export async function handleVideoJob(job: DbJob) {
  const input = job.input as { scene_id: string; prompt: string; image_url?: string; duration?: number; provider?: string }
  console.log(`[video] Job ${job.id} — scene ${input.scene_id}, provider: ${input.provider ?? 'none configured'}`)

  await updateJobStatus(job.id, 'failed', {
    error_message: 'Video provider not yet configured. Add your provider in server/worker/handlers/video.ts',
  })
}
