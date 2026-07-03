// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AudioStage from '../../../app/components/stages/AudioStage.vue'

function makeScene(id: string, index: number, scriptText: string) {
  return {
    id,
    project_id: 'p1',
    job_id: null,
    scene_index: index,
    title: `Scene ${index}`,
    script_text: scriptText,
    start_time: index * 5,
    end_time: index * 5 + 5,
    duration: 5,
    order_index: index,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('AudioStage — audio mismatch dot', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob() })))
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function stubFetch(scenes: ReturnType<typeof makeScene>[], sceneSnapshot: { id: string; script_text: string }[] | null) {
    const dollarFetchMock = vi.fn(async (url: string) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/audio') {
        return sceneSnapshot ? { url: 'https://cdn.test/voice.mp3', sceneSnapshot } : null
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', dollarFetchMock)
    return dollarFetchMock
  }

  it('shows no dot when current scenes match the generation snapshot', async () => {
    const scenes = [makeScene('s1', 0, 'hello'), makeScene('s2', 1, 'world')]
    stubFetch(scenes, scenes.map(s => ({ id: s.id, script_text: s.script_text })))

    const wrapper = mount(AudioStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="audio-mismatch-dot"]').exists()).toBe(false)
  })

  it('shows the dot when a scene\'s text changed since the audio was generated', async () => {
    const scenes = [makeScene('s1', 0, 'hello EDITED'), makeScene('s2', 1, 'world')]
    stubFetch(scenes, [{ id: 's1', script_text: 'hello' }, { id: 's2', script_text: 'world' }])

    const wrapper = mount(AudioStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="audio-mismatch-dot"]').exists()).toBe(true)
  })

  it('shows the dot when a scene was deleted since the audio was generated', async () => {
    const scenes = [makeScene('s1', 0, 'hello')]
    stubFetch(scenes, [{ id: 's1', script_text: 'hello' }, { id: 's2', script_text: 'world' }])

    const wrapper = mount(AudioStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="audio-mismatch-dot"]').exists()).toBe(true)
  })

  it('shows the dot when scenes were reordered since the audio was generated', async () => {
    const scenes = [makeScene('s2', 0, 'world'), makeScene('s1', 1, 'hello')]
    stubFetch(scenes, [{ id: 's1', script_text: 'hello' }, { id: 's2', script_text: 'world' }])

    const wrapper = mount(AudioStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="audio-mismatch-dot"]').exists()).toBe(true)
  })

  it('shows no dot when there is no audio generated yet', async () => {
    const scenes = [makeScene('s1', 0, 'hello')]
    stubFetch(scenes, null)

    const wrapper = mount(AudioStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="audio-mismatch-dot"]').exists()).toBe(false)
  })
})
