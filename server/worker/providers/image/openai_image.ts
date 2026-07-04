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
      // OpenAI only accepts a fixed size enum — '1024x1536' is its closest portrait
      // preset to VIDEO_FORMAT's hardcoded 9:16.
      size: '1024x1536',
      // GPT image models (gpt-image-1/1.5/2) always return base64 data — `response_format`
      // is not a supported param for them (unlike dall-e-2/3), so it must not be sent.
    })

    const b64 = res.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI Images returned no image data')

    return { rawBuffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' }
  }
}
