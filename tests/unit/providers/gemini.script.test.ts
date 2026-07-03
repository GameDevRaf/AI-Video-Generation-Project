// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent }
  },
}))

describe('GeminiScriptProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps messages to text parts and passes system instruction', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'ok' })
    const { GeminiScriptProvider } = await import('../../../server/worker/providers/script/gemini')
    await new GeminiScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gemini-2.5-flash',
      systemPrompt: 'You are a director',
      messages: [{ role: 'user', content: 'Write it' }],
    })
    const call = mockGenerateContent.mock.calls[0][0]
    expect(call.config.systemInstruction).toBe('You are a director')
    expect(call.contents[0]).toEqual({ role: 'user', parts: [{ text: 'Write it' }] })
  })

  it('appends inlineData image parts to the last user turn', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'ok' })
    const { GeminiScriptProvider } = await import('../../../server/worker/providers/script/gemini')
    await new GeminiScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Animate' }],
      images: [{ base64: 'IMG', mimeType: 'image/png' }],
    })
    const parts = mockGenerateContent.mock.calls[0][0].contents[0].parts
    expect(parts).toEqual([
      { text: 'Animate' },
      { inlineData: { data: 'IMG', mimeType: 'image/png' } },
    ])
  })

  it('reserves a separate thinking budget so it cannot truncate the output', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'ok' })
    const { GeminiScriptProvider } = await import('../../../server/worker/providers/script/gemini')
    await new GeminiScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Write the motion prompt' }],
      maxTokens: 1024,
    })
    const config = mockGenerateContent.mock.calls[0][0].config
    // thinking gets its own budget, added on top of the caller's output budget
    expect(config.thinkingConfig.thinkingBudget).toBeGreaterThan(0)
    expect(config.maxOutputTokens).toBe(1024 + config.thinkingConfig.thinkingBudget)
  })

  it('omits thinking config for Gemma models that do not support it', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'ok' })
    const { GeminiScriptProvider } = await import('../../../server/worker/providers/script/gemini')
    await new GeminiScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gemma-4-31b-it',
      messages: [{ role: 'user', content: 'Write the motion prompt' }],
      maxTokens: 1024,
    })
    const config = mockGenerateContent.mock.calls[0][0].config
    expect(config.maxOutputTokens).toBe(1024)
    expect(config.thinkingConfig).toBeUndefined()
  })
})
