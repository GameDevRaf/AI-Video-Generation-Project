import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeFileOutput } from '../lib/jobs'
import { adminSupabase } from '../lib/supabase'
import { createSignedAssetUrl } from '../../utils/storage'
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
    image_path?: string
    image_url?: string // Legacy/external-provider compatibility; internal assets use image_path.
    duration?: number
    provider?: string
    model?: string
  }

  const providerId = input.provider ?? job.provider ?? 'runway'
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'gen4_turbo'

  await updateJobStatus(job.id, 'waiting_on_provider', {})

  const apiKey = await getProviderKey(meta?.keyProviderId ?? providerId, job.user_id)
  const provider = providerRegistry.video(providerId)

  const imageUrl = input.image_path
    ? await createSignedAssetUrl(adminSupabase, input.image_path)
    : input.image_url

  const result = await provider.generate({
    job,
    apiKey,
    model,
    prompt: input.prompt,
    imageUrl,
    duration: input.duration ?? 5,
  })

  // Providers like Veo and HF return rawBuffer directly (auth-gated or inline bytes)
  const { buffer, mime } = result.rawBuffer
    ? { buffer: result.rawBuffer, mime: result.mimeType ?? 'video/mp4' }
    : await downloadVideoUrl(result.videoUrl!)

  const ext = mime.split('/')[1]?.split(';')[0] ?? 'mp4'
  const storagePath = `${job.project_id}/videos/${input.scene_id}_${Date.now()}.${ext}`

  await storeFileOutput(job, buffer, storagePath, 'video', `scene_video_${input.scene_id}`, mime, { prompt: input.prompt })

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { scene_id: input.scene_id, provider: providerId, model },
  })
}
