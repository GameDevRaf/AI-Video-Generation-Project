import type { ImageProvider, ImageParams, ImageResult } from '../types'
import { VIDEO_FORMAT } from '../../../../shared/config/videoFormat'

// Hugging Face Inference API — text-to-image
// Endpoint: POST https://api-inference.huggingface.co/models/{model}
// Response: raw image bytes (PNG/JPEG depending on model)
// Docs: https://huggingface.co/docs/inference-providers/en/tasks/text-to-image
const HF_BASE = 'https://api-inference.huggingface.co/models'
const MAX_RETRY_ATTEMPTS = 3
const MODEL_LOAD_WAIT_MS = 20_000  // Wait before retrying when model is loading

export class HuggingFaceImageProvider implements ImageProvider {
  readonly providerId = 'huggingface_image'

  async generate(params: ImageParams): Promise<ImageResult> {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      const res = await fetch(`${HF_BASE}/${params.model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'image/png,image/jpeg,image/*',
        },
        body: JSON.stringify({
          inputs: params.prompt,
          parameters: {
            width: VIDEO_FORMAT.width,
            height: VIDEO_FORMAT.height,
            num_inference_steps: 25,
            guidance_scale: 7.5,
          },
        }),
      })

      // Model loading — HF returns 503 while loading
      if (res.status === 503) {
        const json = await res.json().catch(() => ({})) as { estimated_time?: number }
        const waitMs = Math.min((json.estimated_time ?? 20) * 1000, MODEL_LOAD_WAIT_MS)
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }
        throw new Error(`Hugging Face model "${params.model}" is loading. Try again in a moment.`)
      }

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Hugging Face image error ${res.status}: ${err}`)
      }

      const rawBuffer = Buffer.from(await res.arrayBuffer())
      const mimeType = res.headers.get('content-type') ?? 'image/png'
      return { rawBuffer, mimeType }
    }

    throw new Error('Hugging Face image: max retry attempts exceeded')
  }
}
