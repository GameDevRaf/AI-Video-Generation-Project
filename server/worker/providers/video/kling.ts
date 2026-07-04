import { SignJWT } from 'jose'
import type { VideoProvider, VideoParams, VideoResult } from '../types'
import { VIDEO_FORMAT } from '../../../../shared/config/videoFormat'

// Kling requires two credentials stored as JSON: { ak, sk }
// Store as JSON.stringify({ ak: "...", sk: "..." }) in api_keys.encrypted_secret

async function makeKlingJWT(ak: string, sk: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: ak, exp: now + 1800, nbf: now - 5 })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(sk))
}

// Global (non-China) traffic endpoint — api.klingai.com is the legacy/China host.
const KLING_BASE = 'https://api-singapore.klingai.com'
const POLL_INTERVAL_MS = 10_000
const MAX_ATTEMPTS = 60  // 10 min max

export class KlingVideoProvider implements VideoProvider {
  readonly providerId = 'kling'

  async generate(params: VideoParams): Promise<VideoResult> {
    let ak: string
    let sk: string

    try {
      const creds = JSON.parse(params.apiKey) as { ak: string; sk: string }
      ak = creds.ak
      sk = creds.sk
    } catch {
      throw new Error('Kling credentials must be stored as JSON: {"ak":"...","sk":"..."}')
    }

    const token = await makeKlingJWT(ak, sk)

    const createRes = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: params.model,
        image: params.imageUrl,
        prompt: params.prompt,
        duration: String(Math.round(params.duration ?? 5)),
        aspect_ratio: VIDEO_FORMAT.aspectRatio,
      }),
    })

    if (!createRes.ok) {
      const msg = await createRes.text().catch(() => createRes.statusText)
      throw new Error(`Kling submit error ${createRes.status}: ${msg}`)
    }

    const createData = await createRes.json() as { data: { task_id: string } }
    const taskId = createData.data?.task_id
    if (!taskId) throw new Error('Kling returned no task_id')

    // Poll — regenerate JWT each attempt (30-min expiry risk in long polls)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      const freshToken = await makeKlingJWT(ak, sk)
      const pollRes = await fetch(`${KLING_BASE}/v1/videos/image2video/${taskId}`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })

      if (!pollRes.ok) continue

      const pollData = await pollRes.json() as {
        data: { task_status: string; task_status_msg?: string; task_result?: { videos: Array<{ url: string }> } }
      }
      const { task_status, task_status_msg, task_result } = pollData.data

      if (task_status === 'succeed') {
        const videoUrl = task_result?.videos[0]?.url
        if (!videoUrl) throw new Error('Kling task succeeded but returned no video URL')
        return { videoUrl }
      }

      if (task_status === 'failed') {
        throw new Error(`Kling task failed: ${task_status_msg ?? 'unknown error'}`)
      }
    }

    throw new Error('Kling video generation timed out after 10 minutes')
  }
}
