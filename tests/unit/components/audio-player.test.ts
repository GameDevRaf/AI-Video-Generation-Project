// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayer from '../../../app/components/AudioPlayer.vue'

const scenes = [{
  id: 'scene-1',
  project_id: 'project-1',
  job_id: null,
  scene_index: 0,
  title: 'Opening',
  script_text: 'Hello world',
  start_time: 0,
  end_time: 2,
  duration: 2,
  order_index: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}]

describe('AudioPlayer', () => {
  const fetchMock = vi.fn()
  const createObjectURL = vi.fn(() => 'blob:audio-download')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('downloads the audio track through a blob URL', async () => {
    const clickMock = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const createElementSpy = vi.spyOn(document, 'createElement')

    createElementSpy.mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: clickMock })
        Object.defineProperty(element, 'remove', { value: vi.fn() })
      }
      return element
    })

    const wrapper = mount(AudioPlayer, {
      props: {
        audioUrl: 'https://cdn.test/audio/voice.wav',
        scenes,
      },
    })

    await wrapper.get('button[title="Download audio"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/audio/voice.wav')
    expect(createObjectURL).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:audio-download')

    wrapper.unmount()
    createElementSpy.mockRestore()
    appendSpy.mockRestore()
  })
})
