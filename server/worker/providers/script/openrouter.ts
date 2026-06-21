import OpenAI from 'openai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class OpenRouterScriptProvider implements ScriptProvider {
  readonly providerId = 'openrouter'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new OpenAI({
      apiKey: params.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://aivideoapp.com',
        'X-Title': 'AI Video Generator',
      },
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
