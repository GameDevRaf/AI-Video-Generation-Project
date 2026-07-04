import type { ImageProvider, ImageParams, ImageResult } from '../types'
import { VIDEO_FORMAT } from '../../../../shared/config/videoFormat'

// Stability AI v2beta returns raw image bytes (not a JSON URL).
// The handler uses ImageResult.rawBuffer directly — no URL download step.
export class StabilityImageProvider implements ImageProvider {
  readonly providerId = 'stability'

  async generate(params: ImageParams): Promise<ImageResult> {
    const endpoint = params.model === 'stable-diffusion-3-5-large'
      ? 'https://api.stability.ai/v2beta/stable-image/generate/sd3'
      : 'https://api.stability.ai/v2beta/stable-image/generate/core'

    const formData = new FormData()
    formData.append('prompt', params.prompt)
    formData.append('output_format', 'png')
    formData.append('aspect_ratio', VIDEO_FORMAT.aspectRatio)
    // The /sd3 endpoint serves multiple model variants and needs an explicit `model`
    // field — without it the endpoint falls back to its own default, so selecting
    // "SD 3.5 Large" would otherwise have no effect.
    if (params.model === 'stable-diffusion-3-5-large') formData.append('model', 'sd3.5-large')
    if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt)

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        Accept: 'image/*',
      },
      body: formData,
    })

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`Stability AI error ${res.status}: ${msg}`)
    }

    const rawBuffer = Buffer.from(await res.arrayBuffer())
    return { rawBuffer, mimeType: 'image/png' }
  }
}
