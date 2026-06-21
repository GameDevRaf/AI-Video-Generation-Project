import Together from 'together-ai'
import type { ImageProvider, ImageParams, ImageResult } from '../types'

export class TogetherImageProvider implements ImageProvider {
  readonly providerId = 'together_image'

  async generate(params: ImageParams): Promise<ImageResult> {
    const client = new Together({ apiKey: params.apiKey })

    const res = await client.images.create({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      steps: 28,
      width: 1024,
      height: 576,
    })

    const imageUrl = (res.data as Array<{ url?: string }>)[0]?.url
    if (!imageUrl) throw new Error('Together AI returned no image URL')

    return { imageUrl }
  }
}
