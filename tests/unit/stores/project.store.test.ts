// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockProject = {
  id: 'proj-1',
  user_id: 'user-1',
  name: 'Test Project',
  description: null,
  status: 'active',
  current_stage: 'script',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  project_settings: null,
}

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockProject))
  })

  it('starts with null currentProject', () => {
    const store = useProjectStore()
    expect(store.currentProject).toBeNull()
    expect(store.currentStage).toBe('script')
    expect(store.projectId).toBeNull()
  })

  it('loadProject sets currentProject and settings', async () => {
    const store = useProjectStore()
    await store.loadProject('proj-1')
    expect(store.currentProject?.id).toBe('proj-1')
    expect(store.currentProject?.name).toBe('Test Project')
    expect(store.settings).toBeNull()
  })

  it('loadProject with settings populates settings', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      ...mockProject,
      project_settings: { prompt_edit_mode: 'before_generation' },
    }))
    const store = useProjectStore()
    await store.loadProject('proj-1')
    expect(store.settings?.prompt_edit_mode).toBe('before_generation')
  })

  it('currentStage reflects loaded project stage', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ ...mockProject, current_stage: 'audio' }))
    const store = useProjectStore()
    await store.loadProject('proj-1')
    expect(store.currentStage).toBe('audio')
  })

  it('setStage updates currentProject.current_stage and calls PATCH', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockProject)   // loadProject
      .mockResolvedValueOnce({})            // setStage PATCH
    vi.stubGlobal('$fetch', fetchMock)

    const store = useProjectStore()
    await store.loadProject('proj-1')
    await store.setStage('image')

    expect(store.currentProject?.current_stage).toBe('image')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/projects/proj-1', expect.objectContaining({
      method: 'PATCH',
      body: { current_stage: 'image' },
    }))
  })

  it('reset clears all state', async () => {
    const store = useProjectStore()
    await store.loadProject('proj-1')
    store.reset()
    expect(store.currentProject).toBeNull()
    expect(store.settings).toBeNull()
    expect(store.error).toBeNull()
  })

  it('loadProject sets error on fetch failure', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const store = useProjectStore()
    await store.loadProject('proj-bad')
    expect(store.currentProject).toBeNull()
    expect(store.error).toBe('Network error')
  })

  it('loading is true during fetch and false after', async () => {
    let resolveLoad!: (v: typeof mockProject) => void
    vi.stubGlobal('$fetch', vi.fn().mockReturnValue(
      new Promise<typeof mockProject>(res => { resolveLoad = res })
    ))
    const store = useProjectStore()
    const promise = store.loadProject('proj-1')
    expect(store.loading).toBe(true)
    resolveLoad(mockProject)
    await promise
    expect(store.loading).toBe(false)
  })
})
