// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
let capturedOptions: Record<string, unknown> = {}

vi.mock('openai', () => ({
  default: class {
    constructor(opts: Record<string, unknown>) {
      capturedOptions = opts
    }
    chat = { completions: { create: mockCreate } }
  },
}))

describe('OpenRouterScriptProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions = {}
  })

  it('uses OpenRouter base URL and Authorization header', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'hello' } }] })
    const { OpenRouterScriptProvider } = await import('../../../server/worker/providers/script/openrouter')
    await new OpenRouterScriptProvider().generate({
      job: {} as never, apiKey: 'or-key', model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
    })
    expect(capturedOptions.apiKey).toBe('or-key')
    expect(capturedOptions.baseURL).toBe('https://openrouter.ai/api/v1')
  })

  it('returns text from completion', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'script text' } }] })
    const { OpenRouterScriptProvider } = await import('../../../server/worker/providers/script/openrouter')
    const result = await new OpenRouterScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Write a script' }],
    })
    expect(result.text).toBe('script text')
  })

  it('prepends system prompt when provided', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] })
    const { OpenRouterScriptProvider } = await import('../../../server/worker/providers/script/openrouter')
    await new OpenRouterScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm',
      messages: [{ role: 'user', content: 'Q' }],
      systemPrompt: 'You are helpful',
    })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: 'You are helpful' }),
      ]),
    }))
  })
})
