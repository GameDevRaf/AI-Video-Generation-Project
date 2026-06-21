import type { ImageProvider, ImageParams, ImageResult } from '../types'

// Replicate HTTP API: https://replicate.com/docs/reference/http
// Model format: "{owner}/{model-name}" — maps to the official model endpoint.
const REPLICATE_BASE = 'https://api.replicate.com/v1'
const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 60  // 3 minutes max

export class ReplicateImageProvider implements ImageProvider {
  readonly providerId = 'replicate'

  async generate(params: ImageParams): Promise<ImageResult> {
    // Split "owner/model-name" for the official endpoint
    const slashIdx = params.model.indexOf('/')
    if (slashIdx === -1) throw new Error(`Replicate model must be in "owner/model-name" format, got: ${params.model}`)
    const owner = params.model.slice(0, slashIdx)
    const modelName = params.model.slice(slashIdx + 1)

    // Create prediction
    const createRes = await fetch(`${REPLICATE_BASE}/models/${owner}/${modelName}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=30',  // Wait up to 30s synchronously for fast models
      },
      body: JSON.stringify({
        input: {
          prompt: params.prompt,
          ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
          aspect_ratio: params.aspectRatio ?? '16:9',
          num_outputs: 1,
        },
      }),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      throw new Error(`Replicate create prediction failed ${createRes.status}: ${err}`)
    }

    let prediction = await createRes.json() as {
      id: string
      status: string
      output?: unknown
      error?: string
    }

    // Poll until succeeded or failed
    for (let i = 0; i < MAX_POLLS && prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled'; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      const pollRes = await fetch(`${REPLICATE_BASE}/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${params.apiKey}` },
      })
      prediction = await pollRes.json()
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error ?? 'Unknown error'}`)
    }

    const output = prediction.output
    const imageUrl = Array.isArray(output) ? String(output[0]) : String(output)
    if (!imageUrl) throw new Error('Replicate returned no image URL')
    return { imageUrl }
  }
}
