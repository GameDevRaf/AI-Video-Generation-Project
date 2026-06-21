import OpenAI from 'openai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

// HuggingFace Inference Providers expose an OpenAI-compatible chat completions endpoint.
// Base URL: https://router.huggingface.co/v1
// Auth:     Authorization: Bearer {HF_TOKEN}
export class HuggingFaceScriptProvider implements ScriptProvider {
  readonly providerId = 'huggingface'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new OpenAI({
      apiKey: params.apiKey,
      baseURL: 'https://router.huggingface.co/v1',
    })

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = params.systemPrompt
      ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
      : [...params.messages]

    const res = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages,
    })

    return { text: res.choices[0]?.message?.content ?? '' }
  }
}
