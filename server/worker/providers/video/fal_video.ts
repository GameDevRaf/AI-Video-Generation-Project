import { fal } from '@fal-ai/client'
import type { VideoProvider, VideoParams, VideoResult } from '../types'
import { VIDEO_FORMAT } from '../../../../shared/config/videoFormat'

// fal.ai does not use one uniform text-to-video/image-to-video suffix convention
// across model families (Pika needs an explicit suffix on both branches; MiniMax's
// text-to-video endpoint has no suffix at all) — map each catalog model id to its
// real pair of endpoint slugs rather than string-concatenating a suffix.
const ENDPOINTS: Record<string, { textToVideo: string; imageToVideo: string }> = {
  'fal-ai/pika/v2.2': {
    textToVideo: 'fal-ai/pika/v2.2/text-to-video',
    imageToVideo: 'fal-ai/pika/v2.2/image-to-video',
  },
  'fal-ai/minimax/video-01': {
    textToVideo: 'fal-ai/minimax/video-01',
    imageToVideo: 'fal-ai/minimax/video-01/image-to-video',
  },
}

export class FalVideoProvider implements VideoProvider {
  readonly providerId = 'fal_video'

  async generate(params: VideoParams): Promise<VideoResult> {
    const endpoints = ENDPOINTS[params.model]
    if (!endpoints) throw new Error(`Unknown fal.ai video model: "${params.model}"`)
    const endpoint = params.imageUrl ? endpoints.imageToVideo : endpoints.textToVideo

    // Set credentials per-call to avoid leakage between concurrent jobs
    fal.config({ credentials: params.apiKey })

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      duration: Math.round(params.duration ?? 5),
      aspect_ratio: VIDEO_FORMAT.aspectRatio,
    }
    if (params.imageUrl) input.image_url = params.imageUrl

    const result = await fal.subscribe(endpoint, { input }) as { data: { video?: { url: string }; url?: string } }

    const videoUrl = result.data.video?.url ?? result.data.url
    if (!videoUrl) throw new Error(`fal.ai video (${endpoint}) returned no video URL`)

    return { videoUrl }
  }
}
