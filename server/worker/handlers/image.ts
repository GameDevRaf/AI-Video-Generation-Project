import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeFileOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

async function downloadImageUrl(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download image from provider: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const mime = res.headers.get('content-type') ?? 'image/png'
  return { buffer, mime }
}

export async function handleImageJob(job: DbJob) {
  const input = job.input as {
    scene_id: string
    prompt: string
    provider?: string
    model?: string
    negative_prompt?: string
    aspect_ratio?: string
  }

  const providerId = input.provider ?? job.provider ?? 'fal'
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'fal-ai/flux-pro/v1.1'

  await updateJobStatus(job.id, 'waiting_on_provider', {})

  const apiKey = await getProviderKey(meta?.keyProviderId ?? providerId, job.user_id)
  const provider = providerRegistry.image(providerId)

  const result = await provider.generate({
    job,
    apiKey,
    model,
    prompt: input.prompt,
    negativePrompt: input.negative_prompt,
    aspectRatio: input.aspect_ratio ?? '16:9',
  })

  // Stability AI returns rawBuffer directly; all others return a URL to download
  const { buffer, mime } = result.rawBuffer
    ? { buffer: result.rawBuffer, mime: result.mimeType ?? 'image/png' }
    : await downloadImageUrl(result.imageUrl!)

  const ext = mime.split('/')[1]?.split(';')[0] ?? 'png'
  const storagePath = `${job.project_id}/images/${input.scene_id}_${Date.now()}.${ext}`

  await storeFileOutput(job, buffer, storagePath, 'image', `scene_image_${input.scene_id}`, mime)

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { scene_id: input.scene_id, provider: providerId, model },
  })
}
