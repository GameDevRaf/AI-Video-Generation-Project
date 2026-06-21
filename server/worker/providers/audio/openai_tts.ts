import OpenAI from 'openai'
import type { AudioProvider, AudioParams, AudioResult } from '../types'

const OPENAI_TTS_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'] as const
type OpenAIVoice = typeof OPENAI_TTS_VOICES[number]

export class OpenAITTSProvider implements AudioProvider {
  readonly providerId = 'openai_tts'

  async generate(params: AudioParams): Promise<AudioResult> {
    const client = new OpenAI({ apiKey: params.apiKey })

    // Default voice if the voiceId isn't a valid OpenAI TTS voice
    const voice: OpenAIVoice = (OPENAI_TTS_VOICES as readonly string[]).includes(params.voiceId)
      ? params.voiceId as OpenAIVoice
      : 'onyx'

    const res = await client.audio.speech.create({
      model: params.model,
      voice,
      input: params.text,
      speed: params.speed ?? 1.0,
    })

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    return { audioBuffer, mimeType: 'audio/mpeg' }
  }
}
