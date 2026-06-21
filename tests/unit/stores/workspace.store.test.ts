// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial state is empty', () => {
    const store = useWorkspaceStore()
    expect(store.projectId).toBeNull()
    expect(store.activeScriptText).toBeNull()
    expect(store.activeScriptOutputId).toBeNull()
    expect(store.isPlaying).toBe(false)
    expect(store.playbackTime).toBe(0)
    expect(store.isTimelineExpanded).toBe(false)
  })

  it('setProject stores the project ID', () => {
    const store = useWorkspaceStore()
    store.setProject('proj-abc')
    expect(store.projectId).toBe('proj-abc')
  })

  it('setActiveScript stores text and optional output ID', () => {
    const store = useWorkspaceStore()
    store.setActiveScript('Hello world', 'out-123')
    expect(store.activeScriptText).toBe('Hello world')
    expect(store.activeScriptOutputId).toBe('out-123')
  })

  it('setActiveScript works without outputId', () => {
    const store = useWorkspaceStore()
    store.setActiveScript('Just text')
    expect(store.activeScriptText).toBe('Just text')
    expect(store.activeScriptOutputId).toBeNull()
  })

  it('clearActiveScript nulls script state', () => {
    const store = useWorkspaceStore()
    store.setActiveScript('Some text', 'out-1')
    store.clearActiveScript()
    expect(store.activeScriptText).toBeNull()
    expect(store.activeScriptOutputId).toBeNull()
  })

  it('reset clears all state including timeline', () => {
    const store = useWorkspaceStore()
    store.setProject('proj-1')
    store.setActiveScript('text', 'id')
    store.isPlaying = true
    store.playbackTime = 12.5
    store.isTimelineExpanded = true
    store.reset()
    expect(store.activeScriptText).toBeNull()
    expect(store.activeScriptOutputId).toBeNull()
    expect(store.isPlaying).toBe(false)
    expect(store.playbackTime).toBe(0)
    expect(store.isTimelineExpanded).toBe(false)
  })

  it('setProject does not reset script state', () => {
    const store = useWorkspaceStore()
    store.setActiveScript('kept text')
    store.setProject('new-proj')
    expect(store.activeScriptText).toBe('kept text')
  })
})
