import Groq from 'groq-sdk'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class GroqScriptProvider implements ScriptProvider {
  readonly providerId = 'groq'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new Groq({ apiKey: params.apiKey })

    const messages: Groq.Chat.ChatCompletionMessageParam[] = params.systemPrompt
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
