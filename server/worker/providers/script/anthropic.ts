import Anthropic from '@anthropic-ai/sdk'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class AnthropicScriptProvider implements ScriptProvider {
  readonly providerId = 'anthropic'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new Anthropic({ apiKey: params.apiKey })

    const message = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.systemPrompt,
      messages: params.messages,
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return { text }
  }
}
