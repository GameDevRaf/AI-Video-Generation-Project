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

const mockUpdateJobStatus = vi.fn()
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
}))

// Supabase mock: record the scenes delete/insert and the stale visual-description cleanup.
const scenesDeleteEq = vi.fn(async () => ({ error: null }))
const scenesDelete = vi.fn(() => ({ eq: scenesDeleteEq }))
const scenesInsert = vi.fn(async () => ({ error: null }))

const jobOutputsLike = vi.fn(async () => ({ error: null }))
const jobOutputsEq = vi.fn(() => ({ like: jobOutputsLike }))
const jobOutputsDelete = vi.fn(() => ({ eq: jobOutputsEq }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'scenes') return { delete: scenesDelete, insert: scenesInsert }
  if (table === 'job_outputs') return { delete: jobOutputsDelete }
  return {}
})

vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: mockFrom },
}))

const BASE_JOB = {
  id: 'job-scene-split',
  project_id: 'project-1',
  user_id: 'user-1',
  provider: 'anthropic',
  model: null,
  input: { script_text: 'Hello world. This is a test.' },
}

describe('scene split handler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces scenes and clears stale visual descriptions for the project', async () => {
    mockScriptGenerate.mockResolvedValueOnce({
      text: JSON.stringify([
        { title: 'Intro', script_text: 'Hello world.', duration: 3 },
        { title: 'Body', script_text: 'This is a test.', duration: 4 },
      ]),
    })

    const { handleSceneSplitJob } = await import('../../../server/worker/handlers/scene_split')
    await handleSceneSplitJob(BASE_JOB as never)

    // Old scenes wiped, new scenes inserted
    expect(scenesDelete).toHaveBeenCalledTimes(1)
    expect(scenesInsert).toHaveBeenCalledTimes(1)
    expect(scenesInsert.mock.calls[0][0]).toHaveLength(2)

    // Stale visual descriptions + anchor removed so they regenerate next time
    expect(jobOutputsDelete).toHaveBeenCalledTimes(1)
    expect(jobOutputsEq).toHaveBeenCalledWith('project_id', 'project-1')
    expect(jobOutputsLike).toHaveBeenCalledWith('label', 'visual_%')

    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-scene-split', 'completed', expect.anything())
  })

  it('prefers input.provider/input.model over the job-level defaults (Script tab selection)', async () => {
    mockScriptGenerate.mockResolvedValueOnce({
      text: JSON.stringify([{ title: 'Intro', script_text: 'Hello world. This is a test.', duration: 5 }]),
    })

    const { handleSceneSplitJob } = await import('../../../server/worker/handlers/scene_split')
    await handleSceneSplitJob({
      ...BASE_JOB,
      input: { script_text: 'Hello world. This is a test.', provider: 'gemini', model: 'gemini-3-flash' },
    } as never)

    expect(mockRegistryScript).toHaveBeenCalledWith('gemini')
    expect(mockGetProviderKey).toHaveBeenCalledWith('gemini', 'user-1')
    expect(mockScriptGenerate.mock.calls[0][0].model).toBe('gemini-3-flash')
  })
})
