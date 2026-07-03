import RunwayML from '@runwayml/sdk'
import type { ImageToVideoCreateParams } from '@runwayml/sdk/resources/image-to-video.js'
import type { VideoProvider, VideoParams, VideoResult } from '../types'

const POLL_INTERVAL_MS = 5_000
const MAX_ATTEMPTS = 120 // 10 min max

export class RunwayVideoProvider implements VideoProvider {
  readonly providerId = 'runway'

  async generate(params: VideoParams): Promise<VideoResult> {
    const client = new RunwayML({ apiKey: params.apiKey })

    if (!params.imageUrl) {
      throw new Error('Runway requires an imageUrl (first-frame image) for image-to-video generation')
    }

    const task = await client.imageToVideo.create({
      model: params.model,
      promptImage: params.imageUrl,
      promptText: params.prompt,
      // Runway only accepts a fixed set of "W:H" ratio presets — '720:1280' is its
      // portrait preset matching VIDEO_FORMAT's hardcoded 9:16.
      ratio: '720:1280',
      duration: Math.round(params.duration ?? 5),
    } as ImageToVideoCreateParams)

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      const result = await client.tasks.retrieve(task.id)

      if (result.status === 'SUCCEEDED') {
        const videoUrl = result.output[0]
        if (!videoUrl) throw new Error('Runway task completed but returned no video URL')
        return { videoUrl }
      }

      if (result.status === 'FAILED') {
        throw new Error(`Runway generation failed: ${result.failure}`)
      }

      if (result.status === 'CANCELLED') {
        throw new Error('Runway generation was cancelled')
      }
    }

    throw new Error('Runway video generation timed out after 10 minutes')
  }
}
