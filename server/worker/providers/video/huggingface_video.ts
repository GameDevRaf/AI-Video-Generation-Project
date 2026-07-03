import type { VideoProvider, VideoParams, VideoResult } from '../types'
import { VIDEO_FORMAT } from '../../../../shared/config/videoFormat'

// Hugging Face Inference API — text-to-video
// Endpoint: POST https://api-inference.huggingface.co/models/{model}
// Response: raw video bytes
// Docs: https://huggingface.co/docs/inference-providers/en/tasks/text-to-video
const HF_BASE = 'https://api-inference.huggingface.co/models'
const MAX_RETRY_ATTEMPTS = 3
const MODEL_LOAD_WAIT_MS = 30_000  // Video models take longer to load

export class HuggingFaceVideoProvider implements VideoProvider {
  readonly providerId = 'huggingface_video'

  async generate(params: VideoParams): Promise<VideoResult> {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      const res = await fetch(`${HF_BASE}/${params.model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'video/mp4,video/*',
        },
        body: JSON.stringify({
          inputs: params.prompt,
          parameters: {
            num_frames: Math.round((params.duration ?? 5) * 8),  // ~8fps for most HF video models
            num_inference_steps: 25,
            width: VIDEO_FORMAT.width,
            height: VIDEO_FORMAT.height,
          },
        }),
      })

      if (res.status === 503) {
        const json = await res.json().catch(() => ({})) as { estimated_time?: number }
        const waitMs = Math.min((json.estimated_time ?? 30) * 1000, MODEL_LOAD_WAIT_MS)
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }
        throw new Error(`Hugging Face model "${params.model}" is loading. Try again in a moment.`)
      }

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Hugging Face video error ${res.status}: ${err}`)
      }

      const rawBuffer = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') ?? 'video/mp4'
      const mimeType = contentType.startsWith('video/') ? contentType.split(';')[0] : 'video/mp4'
      return { rawBuffer, mimeType }
    }

    throw new Error('Hugging Face video: max retry attempts exceeded')
  }
}
