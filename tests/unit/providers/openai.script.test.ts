// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCompletionsCreate = vi.fn()
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCompletionsCreate } }
    images = { generate: vi.fn() }
    audio = { speech: { create: vi.fn() } }
  },
}))

describe('OpenAIScriptProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls chat.completions.create with model and messages', async () => {
    mockCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Generated script text' } }],
    })
    const { OpenAIScriptProvider } = await import('../../../server/worker/providers/script/openai')
    await new OpenAIScriptProvider().generate({
      job: {} as never, apiKey: 'oai-key', model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'Write a script' }],
    })
    expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4.1',
      messages: expect.arrayContaining([{ role: 'user', content: 'Write a script' }]),
    }))
  })

  it('prepends system prompt as a system message when provided', async () => {
    mockCompletionsCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] })
    const { OpenAIScriptProvider } = await import('../../../server/worker/providers/script/openai')
    await new OpenAIScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'You are a scriptwriter',
    })
    const callMessages = mockCompletionsCreate.mock.calls[0][0].messages
    expect(callMessages[0]).toEqual({ role: 'system', content: 'You are a scriptwriter' })
  })

  it('returns text from choices[0].message.content', async () => {
    mockCompletionsCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'Final script output' } }] })
    const { OpenAIScriptProvider } = await import('../../../server/worker/providers/script/openai')
    const result = await new OpenAIScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'Write' }],
    })
    expect(result.text).toBe('Final script output')
  })

  it('attaches images to the last user message as a data-URL image_url part', async () => {
    mockCompletionsCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] })
    const { OpenAIScriptProvider } = await import('../../../server/worker/providers/script/openai')
    await new OpenAIScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Describe the motion' }],
      images: [{ base64: 'AAAA', mimeType: 'image/png' }],
    })
    const callMessages = mockCompletionsCreate.mock.calls[0][0].messages
    const userMsg = callMessages[callMessages.length - 1]
    expect(userMsg.content).toEqual([
      { type: 'text', text: 'Describe the motion' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ])
  })

  it('keeps the user message as a plain string when no images are provided', async () => {
    mockCompletionsCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] })
    const { OpenAIScriptProvider } = await import('../../../server/worker/providers/script/openai')
    await new OpenAIScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'No image here' }],
    })
    const callMessages = mockCompletionsCreate.mock.calls[0][0].messages
    expect(callMessages[callMessages.length - 1]).toEqual({ role: 'user', content: 'No image here' })
  })
})
