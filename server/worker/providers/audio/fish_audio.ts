import type { AudioProvider, AudioParams, AudioResult } from '../types'

// Fish Audio TTS API
// Endpoint: POST https://api.fish.audio/v1/tts
// Auth:     Authorization: Bearer {token}
// Model goes in the "model" HTTP header (s1 or s2-pro), not the body.
// Docs: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
export class FishAudioProvider implements AudioProvider {
  readonly providerId = 'fish_audio'

  async generate(params: AudioParams): Promise<AudioResult> {
    const body: Record<string, unknown> = {
      text: params.text,
      format: 'mp3',
      sample_rate: 44100,
    }

    // reference_id is the voice/character ID from Fish Audio's voice library
    if (params.voiceId) {
      body.reference_id = params.voiceId
    }

    // Speed is expressed as prosody.speed (0.5–2.0)
    if (params.speed !== undefined) {
      body.prosody = { speed: params.speed }
    }

    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
        model: params.model,  // Fish Audio uses this HTTP header for model selection
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Fish Audio TTS error ${res.status}: ${err}`)
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    return { audioBuffer, mimeType: 'audio/mpeg' }
  }
}
