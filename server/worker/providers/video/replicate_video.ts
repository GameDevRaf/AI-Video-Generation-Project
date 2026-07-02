import type { VideoProvider, VideoParams, VideoResult } from '../types'

// Replicate video generation
// Create: POST /v1/models/{owner}/{model}/predictions
// Poll:   GET  /v1/predictions/{id}
// Output: output[0] is a URL to the video file.
// Docs: https://replicate.com/docs/reference/http
const REPLICATE_BASE = 'https://api.replicate.com/v1'
const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 120  // 10 minutes max

export class ReplicateVideoProvider implements VideoProvider {
  readonly providerId = 'replicate_video'

  async generate(params: VideoParams): Promise<VideoResult> {
    const slashIdx = params.model.indexOf('/')
    if (slashIdx === -1) throw new Error(`Replicate model must be "owner/model-name", got: ${params.model}`)
    const owner = params.model.slice(0, slashIdx)
    const modelName = params.model.slice(slashIdx + 1)

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      duration: Math.round(params.duration ?? 5),
      aspect_ratio: params.aspectRatio ?? '16:9',
    }
    if (params.imageUrl) {
      input.image_url = params.imageUrl
    }

    const createRes = await fetch(`${REPLICATE_BASE}/models/${owner}/${modelName}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      throw new Error(`Replicate video create failed ${createRes.status}: ${err}`)
    }

    let prediction = await createRes.json() as {
      id: string
      status: string
      output?: unknown
      error?: string
    }

    for (let i = 0; i < MAX_POLLS && prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled'; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      const pollRes = await fetch(`${REPLICATE_BASE}/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${params.apiKey}` },
      })
      prediction = await pollRes.json()
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`Replicate video ${prediction.status}: ${prediction.error ?? 'Unknown error'}`)
    }

    const output = prediction.output
    const videoUrl = Array.isArray(output) ? String(output[0]) : String(output)
    if (!videoUrl) throw new Error('Replicate video returned no output URL')
    return { videoUrl }
  }
}
