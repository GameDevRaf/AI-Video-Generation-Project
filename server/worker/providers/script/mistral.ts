import { Mistral } from '@mistralai/mistralai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class MistralScriptProvider implements ScriptProvider {
  readonly providerId = 'mistral'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new Mistral({ apiKey: params.apiKey })

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =
      params.systemPrompt
        ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
        : [...params.messages]

    const res = await client.chat.complete({
      model: params.model,
      maxTokens: params.maxTokens ?? 4096,
      messages,
    })

    const content = res.choices?.[0]?.message?.content
    return { text: typeof content === 'string' ? content : '' }
  }
}
