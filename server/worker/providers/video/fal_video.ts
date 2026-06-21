import { fal } from '@fal-ai/client'
import type { VideoProvider, VideoParams, VideoResult } from '../types'

export class FalVideoProvider implements VideoProvider {
  readonly providerId = 'fal_video'

  async generate(params: VideoParams): Promise<VideoResult> {
    // Set credentials per-call to avoid leakage between concurrent jobs
    fal.config({ credentials: params.apiKey })

    const result = await fal.subscribe(params.model, {
      input: {
        prompt: params.prompt,
        image_url: params.imageUrl,
        duration: params.duration ?? 5,
        aspect_ratio: params.aspectRatio ?? '16:9',
      },
    }) as { data: { video?: { url: string }; url?: string } }

    const videoUrl = result.data.video?.url ?? result.data.url
    if (!videoUrl) throw new Error(`fal.ai video (${params.model}) returned no video URL`)

    return { videoUrl }
  }
}
