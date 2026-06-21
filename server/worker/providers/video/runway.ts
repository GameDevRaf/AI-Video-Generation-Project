import RunwayML from '@runwayml/sdk'
import type { VideoProvider, VideoParams, VideoResult } from '../types'

export class RunwayVideoProvider implements VideoProvider {
  readonly providerId = 'runway'

  async generate(params: VideoParams): Promise<VideoResult> {
    const client = new RunwayML({ apiKey: params.apiKey })

    if (!params.imageUrl) {
      throw new Error('Runway requires an imageUrl (first-frame image) for image-to-video generation')
    }

    const task = await client.imageToVideo.create({
      model: params.model as 'gen4_turbo' | 'gen4',
      promptImage: params.imageUrl,
      promptText: params.prompt,
      ratio: '1280:720',
      duration: (params.duration ?? 5) as 5 | 10,
    })

    // SDK's waitForTaskOutput polls every ~5s until completed or failed
    const completed = await client.tasks.waitForTaskOutput(task.id)

    const videoUrl = (completed.output as string[] | undefined)?.[0]
    if (!videoUrl) throw new Error('Runway task completed but returned no video URL')

    return { videoUrl }
  }
}
