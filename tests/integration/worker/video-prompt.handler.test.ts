// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockScriptGenerate = vi.fn()
const mockRegistryScript = vi.fn(() => ({ generate: mockScriptGenerate }))
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { script: mockRegistryScript },
}))

const mockGetProviderKey = vi.fn().mockResolvedValue('provider-key')
vi.mock('../../../server/worker/lib/getProviderKey', () => ({
  getProviderKey: mockGetProviderKey,
}))

const mockStoreTextOutput = vi.fn().mockResolvedValue('out-1')
const mockUpdateJobStatus = vi.fn()
vi.mock('../../../server/worker/lib/jobs', () => ({
  storeTextOutput: mockStoreTextOutput,
  updateJobStatus: mockUpdateJobStatus,
}))

const mockEnsureVisualDescriptions = vi.fn()
vi.mock('../../../server/worker/lib/visualDescriptions', () => ({
  ensureVisualDescriptions: mockEnsureVisualDescriptions,
}))

const allScenes = [
  { id: 'scene-1', title: 'One', script_text: 'First scene', duration: 4 },
  { id: 'scene-2', title: 'Two', script_text: 'Second scene', duration: 5 },
]

const sceneQuery = {
  select: vi.fn(() => sceneQuery),
  eq: vi.fn(() => sceneQuery),
  order: vi.fn(async () => ({ data: allScenes })),
}

// Generated first-frame images for the vision path (configurable per test).
let imageRows: Array<{ label: string; storage_url: string; created_at: string }> = []
const jobOutputsQuery = {
  select: vi.fn(() => jobOutputsQuery),
  eq: vi.fn(() => jobOutputsQuery),
  like: vi.fn(() => jobOutputsQuery),
  order: vi.fn(async () => ({ data: imageRows })),
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'scenes') return sceneQuery
  if (table === 'job_outputs') return jobOutputsQuery
  return {}
})

vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: mockFrom },
}))

const BASE_JOB = {
  id: 'job-video-prompt',
  project_id: 'project-1',
  user_id: 'user-1',
  provider: 'anthropic',
  model: null,
}

describe('video prompt handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    imageRows = []
    mockEnsureVisualDescriptions.mockResolvedValue({
      anchor: 'ANCHOR: cohesive style',
      byScene: new Map([
        ['scene-1', 'desc one'],
        ['scene-2', 'desc two'],
      ]),
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
      headers: { get: () => 'image/png' },
    })))
  })

  it.each(['anthropic', 'openai', 'gemini', 'groq', 'mistral'])(
    'uses selected script provider %s when regenerating one scene',
    async (provider) => {
      mockScriptGenerate.mockResolvedValueOnce({ text: `${provider} motion` })

      const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
      await handleVideoPromptJob({
        ...BASE_JOB,
        provider,
        input: { scene_id: 'scene-2' },
      } as never)

      expect(mockRegistryScript).toHaveBeenCalledWith(provider)
      expect(mockGetProviderKey).toHaveBeenCalledWith(provider, 'user-1')
      expect(mockStoreTextOutput).toHaveBeenCalledTimes(1)
      expect(mockStoreTextOutput).toHaveBeenCalledWith(
        expect.anything(),
        `${provider} motion`,
        'video_prompt_scene_scene-2',
      )

      const call = mockScriptGenerate.mock.calls[0][0]
      expect(call.messages[0].content).toContain('desc two')
      expect(call.systemPrompt).toContain('ANCHOR')
    },
  )

  it('stores prompts for all scenes when no scene id is provided', async () => {
    mockScriptGenerate
      .mockResolvedValueOnce({ text: 'First motion' })
      .mockResolvedValueOnce({ text: 'Second motion' })

    const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
    await handleVideoPromptJob({ ...BASE_JOB, input: {} } as never)

    expect(mockScriptGenerate).toHaveBeenCalledTimes(2)
    expect(mockStoreTextOutput).toHaveBeenCalledTimes(2)
    expect(mockStoreTextOutput.mock.calls.map(call => call[2])).toEqual([
      'video_prompt_scene_scene-1',
      'video_prompt_scene_scene-2',
    ])
  })

  it('attaches the first-frame image to a vision-capable provider call', async () => {
    imageRows = [{ label: 'scene_image_scene-2', storage_url: 'http://img/2.png', created_at: '2026-01-01' }]
    mockScriptGenerate.mockResolvedValueOnce({ text: 'motion with image' })

    const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
    await handleVideoPromptJob({ ...BASE_JOB, provider: 'anthropic', input: { scene_id: 'scene-2' } } as never)

    const call = mockScriptGenerate.mock.calls[0][0]
    expect(call.images).toHaveLength(1)
    expect(call.images[0].mimeType).toBe('image/png')
    expect(typeof call.images[0].base64).toBe('string')
  })

  it('falls back to text-only when no first-frame image exists', async () => {
    imageRows = []
    mockScriptGenerate.mockResolvedValueOnce({ text: 'text only motion' })

    const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
    await handleVideoPromptJob({ ...BASE_JOB, provider: 'anthropic', input: { scene_id: 'scene-2' } } as never)

    const call = mockScriptGenerate.mock.calls[0][0]
    expect(call.images).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('retries text-only when the vision call throws', async () => {
    imageRows = [{ label: 'scene_image_scene-2', storage_url: 'http://img/2.png', created_at: '2026-01-01' }]
    mockScriptGenerate
      .mockRejectedValueOnce(new Error('vision unsupported'))
      .mockResolvedValueOnce({ text: 'recovered motion' })

    const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
    await handleVideoPromptJob({ ...BASE_JOB, provider: 'anthropic', input: { scene_id: 'scene-2' } } as never)

    expect(mockScriptGenerate).toHaveBeenCalledTimes(2)
    // first call carried the image, retry dropped it
    expect(mockScriptGenerate.mock.calls[0][0].images).toHaveLength(1)
    expect(mockScriptGenerate.mock.calls[1][0].images).toBeUndefined()
    expect(mockStoreTextOutput).toHaveBeenCalledWith(expect.anything(), 'recovered motion', 'video_prompt_scene_scene-2')
  })
})
