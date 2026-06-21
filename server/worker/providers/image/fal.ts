import { fal } from '@fal-ai/client'
import type { ImageProvider, ImageParams, ImageResult } from '../types'

export class FalImageProvider implements ImageProvider {
  readonly providerId = 'fal'

  async generate(params: ImageParams): Promise<ImageResult> {
    // Set credentials per-call (NOT globally) to avoid leakage between concurrent jobs
    fal.config({ credentials: params.apiKey })

    const result = await fal.subscribe(params.model, {
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        image_size: 'landscape_16_9',
        num_images: 1,
      },
    }) as { data: { images: Array<{ url: string }> } }

    const imageUrl = result.data.images[0]?.url
    if (!imageUrl) throw new Error('fal.ai returned no image URL')

    return { imageUrl }
  }
}
