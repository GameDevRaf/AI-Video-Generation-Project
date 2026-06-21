import type { AudioProvider, AudioParams, AudioResult } from '../types'

export class CartesiaAudioProvider implements AudioProvider {
  readonly providerId = 'cartesia'

  async generate(params: AudioParams): Promise<AudioResult> {
    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Cartesia-Version': '2025-04-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: params.text,
        model_id: params.model,
        voice: { mode: 'id', id: params.voiceId },
        output_format: {
          container: 'wav',
          encoding: 'pcm_f32le',
          sample_rate: 44100,
        },
      }),
    })

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`Cartesia error ${res.status}: ${msg}`)
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    return { audioBuffer, mimeType: 'audio/wav' }
  }
}
