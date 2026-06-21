import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import type { AudioProvider, AudioParams, AudioResult } from '../types'

export class ElevenLabsAudioProvider implements AudioProvider {
  readonly providerId = 'elevenlabs'

  async generate(params: AudioParams): Promise<AudioResult> {
    const client = new ElevenLabsClient({ apiKey: params.apiKey })

    const audioStream = await client.textToSpeech.convert(params.voiceId, {
      text: params.text,
      modelId: params.model,
      voiceSettings: {
        stability: params.stability ?? 0.5,
        similarityBoost: params.similarityBoost ?? 0.75,
        speed: params.speed ?? 1.0,
      },
    })

    const chunks: Uint8Array[] = []
    for await (const chunk of audioStream) {
      chunks.push(chunk)
    }
    const audioBuffer = Buffer.concat(chunks)

    return { audioBuffer, mimeType: 'audio/mpeg' }
  }
}
