import LumaAI from 'lumaai'
import type { VideoProvider, VideoParams, VideoResult } from '../types'

const POLL_INTERVAL_MS = 3_000
const MAX_ATTEMPTS = 200  // 10 min max

export class LumaVideoProvider implements VideoProvider {
  readonly providerId = 'luma'

  async generate(params: VideoParams): Promise<VideoResult> {
    const client = new LumaAI({ authToken: params.apiKey })

    let generation = await client.generations.create({
      model: params.model as 'ray-2' | 'ray-flash-2',
      prompt: params.prompt,
      resolution: '720p',
      duration: `${Math.round(params.duration ?? 5)}s`,
      ...(params.imageUrl
        ? { keyframes: { frame0: { type: 'image', url: params.imageUrl } } }
        : {}),
    })

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      generation = await client.generations.get(generation.id!)

      if (generation.state === 'completed') {
        const videoUrl = (generation.assets as { video?: string } | undefined)?.video
        if (!videoUrl) throw new Error('Luma completed but returned no video URL')
        return { videoUrl }
      }

      if (generation.state === 'failed') {
        throw new Error(`Luma generation failed: ${(generation as { failure_reason?: string }).failure_reason ?? 'unknown'}`)
      }
    }

    throw new Error('Luma video generation timed out after 10 minutes')
  }
}
