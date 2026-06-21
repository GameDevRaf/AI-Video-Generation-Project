// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MediaPreviewModal from '../../../app/components/MediaPreviewModal.vue'

describe('MediaPreviewModal', () => {
  const fetchMock = vi.fn()
  const createObjectURL = vi.fn(() => 'blob:download')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['media'], { type: 'image/png' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('downloads media through a blob URL instead of navigating to the source URL', async () => {
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

    const wrapper = mount(MediaPreviewModal, {
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
      props: {
        open: true,
        url: 'https://cdn.test/image.png',
        type: 'image',
        downloadName: 'scene.png',
      },
    })

    await wrapper.get('button[title="Download media"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/image.png')
    expect(createObjectURL).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download')

    wrapper.unmount()
    createElementSpy.mockRestore()
    appendSpy.mockRestore()
  })
})
