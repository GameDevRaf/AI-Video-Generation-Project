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
        // fal's image_size enum has no raw "9:16" value — 'portrait_16_9' is its
        // vertical preset, matching VIDEO_FORMAT's hardcoded 9:16.
        image_size: 'portrait_16_9',
        num_images: 1,
      },
    }) as { data: { images: Array<{ url: string }> } }

    const imageUrl = result.data.images[0]?.url
    if (!imageUrl) throw new Error('fal.ai returned no image URL')

    return { imageUrl }
  }
}
