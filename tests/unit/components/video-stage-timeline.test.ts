// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VideoStage from '../../../app/components/stages/VideoStage.vue'

function makeScene(id: string, index: number) {
  return {
    id,
    project_id: 'p1',
    job_id: null,
    scene_index: index,
    title: `Scene ${index + 1}`,
    script_text: `Script ${index + 1}`,
    start_time: index * 5,
    end_time: index * 5 + 5,
    duration: 5,
    order_index: index,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

const scenes = [makeScene('s1', 0), makeScene('s2', 1)]

function stubVideoStageFetch() {
  vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
    if (url === '/api/scenes') return scenes
    if (url === '/api/video-prompts') return []
    if (url === '/api/videos') {
      return scenes.map(scene => ({
        sceneId: scene.id,
        url: `https://cdn.test/${scene.id}.mp4`,
        generationPrompt: '',
      }))
    }
    if (url === '/api/images') {
      return scenes.map(scene => ({
        sceneId: scene.id,
        url: `https://cdn.test/${scene.id}.png`,
        generationPrompt: '',
      }))
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

describe('VideoStage timeline thumbnails', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubEnv('NUXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NUXT_PUBLIC_SUPABASE_KEY', 'test-key')
    stubVideoStageFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('shows video thumbnails in the timeline when Skip Video Gen is disabled', async () => {
    const projectStore = useProjectStore()
    projectStore.settings = { skip_video_gen: false } as typeof projectStore.settings

    const wrapper = mount(VideoStage, {
      props: { projectId: 'p1' },
      global: {
        stubs: {
          MediaPreviewModal: true,
          StagesVideoSceneCard: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="timeline-video-s1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="timeline-image-s1"]').exists()).toBe(false)
  })

  it('shows image thumbnails in the timeline when Skip Video Gen is enabled', async () => {
    const projectStore = useProjectStore()
    projectStore.settings = { skip_video_gen: true } as typeof projectStore.settings

    const wrapper = mount(VideoStage, {
      props: { projectId: 'p1' },
      global: {
        stubs: {
          MediaPreviewModal: true,
          StagesVideoSceneCard: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="timeline-image-s1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="timeline-video-s1"]').exists()).toBe(false)
  })
})
