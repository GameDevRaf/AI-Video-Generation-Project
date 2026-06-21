import type { AudioProvider, AudioParams, AudioResult } from '../types'

// PlayHT requires two credentials stored as JSON: { apiKey, userId }
// Store as JSON.stringify({ apiKey: "...", userId: "..." }) in api_keys.encrypted_secret
export class PlayHTAudioProvider implements AudioProvider {
  readonly providerId = 'playht'

  async generate(params: AudioParams): Promise<AudioResult> {
    let apiKey: string
    let userId: string

    try {
      const creds = JSON.parse(params.apiKey) as { apiKey: string; userId: string }
      apiKey = creds.apiKey
      userId = creds.userId
    } catch {
      throw new Error('PlayHT credentials must be stored as JSON: {"apiKey":"...","userId":"..."}')
    }

    const res = await fetch('https://api.play.ht/api/v2/tts/stream', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-User-Id': userId,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: params.text,
        voice: params.voiceId,
        voice_engine: params.model,
        output_format: 'mp3',
        speed: params.speed ?? 1.0,
      }),
    })

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`PlayHT error ${res.status}: ${msg}`)
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    return { audioBuffer, mimeType: 'audio/mpeg' }
  }
}
