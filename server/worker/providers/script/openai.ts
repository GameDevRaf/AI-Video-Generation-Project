import OpenAI from 'openai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class OpenAIScriptProvider implements ScriptProvider {
  readonly providerId = 'openai'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new OpenAI({ apiKey: params.apiKey })

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
