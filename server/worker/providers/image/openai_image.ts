import OpenAI from 'openai'
import type { ImageProvider, ImageParams, ImageResult } from '../types'

export class OpenAIImageProvider implements ImageProvider {
  readonly providerId = 'openai_image'

  async generate(params: ImageParams): Promise<ImageResult> {
    const client = new OpenAI({ apiKey: params.apiKey })

    const res = await client.images.generate({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    })

    const imageUrl = res.data[0]?.url
    if (!imageUrl) throw new Error('OpenAI Images returned no URL')

    return { imageUrl }
  }
}
