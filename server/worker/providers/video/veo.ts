import type { VideoProvider, VideoParams, VideoResult } from '../types'

// Google Veo video generation via Gemini API (Google AI Studio key)
// Create: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning
// Poll:   GET  https://generativelanguage.googleapis.com/v1beta/{operationName}
// Video URI requires the API key header to download.
// Docs: https://ai.google.dev/gemini-api/docs/video
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const POLL_INTERVAL_MS = 10_000
const MAX_POLLS = 72  // 12 minutes max (Veo can take 5–10 min)

export class VeoVideoProvider implements VideoProvider {
  readonly providerId = 'veo'

  async generate(params: VideoParams): Promise<VideoResult> {
    const url = `${GEMINI_BASE}/models/${params.model}:predictLongRunning`

    // Build the instance — include reference image if provided
    const instance: Record<string, unknown> = { prompt: params.prompt }

    if (params.imageUrl) {
      // Download the reference image and encode it inline
      const imgRes = await fetch(params.imageUrl)
      if (!imgRes.ok) throw new Error(`Failed to download reference image for Veo: ${imgRes.status}`)
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
      const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg'
      instance.image = {
        inlineData: {
          mimeType,
          data: imgBuffer.toString('base64'),
        },
      }
    }

    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': params.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: params.aspectRatio ?? '16:9',
          durationSeconds: String(Math.min(params.duration ?? 8, 8)),
          resolution: '720p',
        },
      }),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      throw new Error(`Veo create error ${createRes.status}: ${err}`)
    }

    const createData = await createRes.json() as { name?: string }
    const operationName = createData.name
    if (!operationName) throw new Error('Veo did not return an operation name')

    // Poll the operation until done
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      const pollRes = await fetch(`${GEMINI_BASE}/${operationName}`, {
        headers: { 'x-goog-api-key': params.apiKey },
      })

      if (!pollRes.ok) {
        const err = await pollRes.text()
        throw new Error(`Veo poll error ${pollRes.status}: ${err}`)
      }

      const pollData = await pollRes.json() as {
        done?: boolean
        error?: { message?: string }
        response?: {
          generateVideoResponse?: {
            generatedSamples?: Array<{
              video?: { uri?: string }
            }>
          }
        }
      }

      if (pollData.error) {
        throw new Error(`Veo generation failed: ${pollData.error.message ?? 'Unknown error'}`)
      }

      if (!pollData.done) continue

      const videoUri = pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      if (!videoUri) throw new Error('Veo completed but returned no video URI')

      // Download video — Veo URIs require the API key header
      const vidRes = await fetch(videoUri, {
        headers: { 'x-goog-api-key': params.apiKey },
      })
      if (!vidRes.ok) throw new Error(`Failed to download Veo video: ${vidRes.status}`)

      const rawBuffer = Buffer.from(await vidRes.arrayBuffer())
      return { rawBuffer, mimeType: 'video/mp4' }
    }

    throw new Error('Veo: generation timed out after 12 minutes')
  }
}
