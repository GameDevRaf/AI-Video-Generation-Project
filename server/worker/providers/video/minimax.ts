import type { VideoProvider, VideoParams, VideoResult } from '../types'

const BASE = 'https://api.minimax.io/v1'
const POLL_INTERVAL_MS = 10_000
const MAX_ATTEMPTS = 60  // 10 min max

export class MiniMaxVideoProvider implements VideoProvider {
  readonly providerId = 'minimax'

  async generate(params: VideoParams): Promise<VideoResult> {
    const headers = {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    }

    // MiniMax only accepts duration 6 or 10 (seconds); there is no 5s option and no
    // aspect_ratio field in this API at all. 768P is a valid resolution for both
    // catalog models (MiniMax-Hailuo-02 and -2.3) at either duration.
    const requestedDuration = Math.round(params.duration ?? 5)
    const duration = requestedDuration >= 8 ? 10 : 6

    const createRes = await fetch(`${BASE}/video_generation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        duration,
        resolution: '768P',
        prompt_optimizer: true,
        ...(params.imageUrl ? { first_frame_image: params.imageUrl } : {}),
      }),
    })

    if (!createRes.ok) {
      const msg = await createRes.text().catch(() => createRes.statusText)
      throw new Error(`MiniMax submit error ${createRes.status}: ${msg}`)
    }

    const { task_id } = await createRes.json() as { task_id: string }
    if (!task_id) throw new Error('MiniMax returned no task_id')

    // Poll for completion
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      const pollRes = await fetch(`${BASE}/query/video_generation?task_id=${task_id}`, { headers })
      if (!pollRes.ok) continue

      const pollData = await pollRes.json() as {
        task_result?: { status: string; file_id?: string }
      }
      const { status, file_id } = pollData.task_result ?? {}

      if (status === 'Success' && file_id) {
        // Retrieve download URL from file ID
        const fileRes = await fetch(`${BASE}/files/retrieve?file_id=${file_id}`, { headers })
        if (!fileRes.ok) throw new Error('MiniMax file retrieve failed')
        const fileData = await fileRes.json() as { file: { download_url: string } }
        const videoUrl = fileData.file?.download_url
        if (!videoUrl) throw new Error('MiniMax returned no download URL')
        return { videoUrl }
      }

      if (status === 'Fail') throw new Error('MiniMax video generation failed')
    }

    throw new Error('MiniMax video generation timed out after 10 minutes')
  }
}
