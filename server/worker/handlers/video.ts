import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeFileOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

async function downloadVideoUrl(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download video from provider: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const mime = res.headers.get('content-type') ?? 'video/mp4'
  return { buffer, mime }
}

export async function handleVideoJob(job: DbJob) {
  const input = job.input as {
    scene_id: string
    prompt: string
    image_url?: string
    duration?: number
    provider?: string
    model?: string
    aspect_ratio?: string
  }

  const providerId = input.provider ?? job.provider ?? 'runway'
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'gen4_turbo'

  await updateJobStatus(job.id, 'waiting_on_provider', {})

  const apiKey = await getProviderKey(providerId, job.user_id)
  const provider = providerRegistry.video(providerId)

  const { videoUrl } = await provider.generate({
    job,
    apiKey,
    model,
    prompt: input.prompt,
    imageUrl: input.image_url,
    duration: input.duration ?? 5,
    aspectRatio: input.aspect_ratio ?? '16:9',
  })

  const { buffer, mime } = await downloadVideoUrl(videoUrl)
  const ext = mime.split('/')[1]?.split(';')[0] ?? 'mp4'
  const storagePath = `${job.project_id}/videos/${input.scene_id}_${Date.now()}.${ext}`

  await storeFileOutput(job, buffer, storagePath, 'video', `scene_video_${input.scene_id}`, mime)

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { scene_id: input.scene_id, provider: providerId, model },
  })
}
