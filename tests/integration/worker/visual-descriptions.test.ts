// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockScriptGenerate = vi.fn()
const mockRegistryScript = vi.fn(() => ({ generate: mockScriptGenerate }))
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { script: mockRegistryScript },
}))

const mockStoreTextOutput = vi.fn().mockResolvedValue('out-1')
vi.mock('../../../server/worker/lib/jobs', () => ({
  storeTextOutput: mockStoreTextOutput,
  updateJobStatus: vi.fn(),
}))

let existingRows: Array<{ label: string; metadata: { content: string }; created_at: string }> = []
const jobOutputsQuery = {
  select: vi.fn(() => jobOutputsQuery),
  eq: vi.fn(() => jobOutputsQuery),
  like: vi.fn(() => jobOutputsQuery),
  order: vi.fn(async () => ({ data: existingRows })),
}
const mockFrom = vi.fn((table: string) => (table === 'job_outputs' ? jobOutputsQuery : {}))
vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: mockFrom },
}))

const JOB = { id: 'job-1', project_id: 'project-1', user_id: 'user-1', provider: 'anthropic', model: null }
const SCENES = [
  { id: 'scene-1', title: 'One', script_text: 'First' },
  { id: 'scene-2', title: 'Two', script_text: 'Second' },
]
const OPTS = { providerId: 'anthropic', apiKey: 'k', model: 'claude-sonnet-4-6', scenes: SCENES }

const GENERATED = JSON.stringify({
  style_anchor: 'Warm hand-drawn style; a girl named Mia in a red coat.',
  scenes: [
    { scene_id: 'scene-1', description: 'Mia walks through a snowy street.' },
    { scene_id: 'scene-2', description: 'Mia opens a glowing door.' },
  ],
})

describe('ensureVisualDescriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existingRows = []
  })

  it('generates and stores anchor + per-scene descriptions when none exist', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: GENERATED })

    const { ensureVisualDescriptions } = await import('../../../server/worker/lib/visualDescriptions')
    const result = await ensureVisualDescriptions(JOB as never, OPTS)

    expect(mockScriptGenerate).toHaveBeenCalledTimes(1)
    expect(result.anchor).toContain('Mia')
    expect(result.byScene.get('scene-1')).toBe('Mia walks through a snowy street.')
    expect(result.byScene.get('scene-2')).toBe('Mia opens a glowing door.')

    // anchor + 2 scene descriptions persisted
    expect(mockStoreTextOutput).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'visual_style_anchor')
    expect(mockStoreTextOutput).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'visual_description_scene_scene-1')
    expect(mockStoreTextOutput).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'visual_description_scene_scene-2')
  })

  it('reuses stored descriptions without calling the LLM when the set is complete', async () => {
    existingRows = [
      { label: 'visual_style_anchor', metadata: { content: 'anchor text' }, created_at: '2026-01-03' },
      { label: 'visual_description_scene_scene-1', metadata: { content: 'desc 1' }, created_at: '2026-01-02' },
      { label: 'visual_description_scene_scene-2', metadata: { content: 'desc 2' }, created_at: '2026-01-01' },
    ]

    const { ensureVisualDescriptions } = await import('../../../server/worker/lib/visualDescriptions')
    const result = await ensureVisualDescriptions(JOB as never, OPTS)

    expect(mockScriptGenerate).not.toHaveBeenCalled()
    expect(mockStoreTextOutput).not.toHaveBeenCalled()
    expect(result.anchor).toBe('anchor text')
    expect(result.byScene.get('scene-1')).toBe('desc 1')
    expect(result.byScene.get('scene-2')).toBe('desc 2')
  })

  it('regenerates when a scene is missing a description', async () => {
    existingRows = [
      { label: 'visual_description_scene_scene-1', metadata: { content: 'desc 1' }, created_at: '2026-01-02' },
    ]
    mockScriptGenerate.mockResolvedValueOnce({ text: GENERATED })

    const { ensureVisualDescriptions } = await import('../../../server/worker/lib/visualDescriptions')
    await ensureVisualDescriptions(JOB as never, OPTS)

    expect(mockScriptGenerate).toHaveBeenCalledTimes(1)
  })
})
