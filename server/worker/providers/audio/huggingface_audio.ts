import type { AudioProvider, AudioParams, AudioResult } from '../types'

// Hugging Face Inference API — text-to-speech
// Endpoint: POST https://api-inference.huggingface.co/models/{model}
// Response: raw audio bytes (wav/mp3 depending on model)
// Docs: https://huggingface.co/docs/inference-providers/en/index
const HF_BASE = 'https://api-inference.huggingface.co/models'
const MAX_RETRY_ATTEMPTS = 3
const MODEL_LOAD_WAIT_MS = 20_000

export class HuggingFaceAudioProvider implements AudioProvider {
  readonly providerId = 'huggingface_audio'

  async generate(params: AudioParams): Promise<AudioResult> {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      const res = await fetch(`${HF_BASE}/${params.model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'audio/wav,audio/mpeg,audio/*',
        },
        body: JSON.stringify({ inputs: params.text }),
      })

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
        throw new Error(`Hugging Face audio error ${res.status}: ${err}`)
      }

      const audioBuffer = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') ?? ''
      const mimeType = contentType.startsWith('audio/') ? (contentType.split(';')[0] ?? 'audio/wav') : 'audio/wav'
      return { audioBuffer, mimeType }
    }

    throw new Error('Hugging Face audio: max retry attempts exceeded')
  }
}
