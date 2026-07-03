// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ImageStage from '../../../app/components/stages/ImageStage.vue'
import VideoStage from '../../../app/components/stages/VideoStage.vue'
import SceneSplitStage from '../../../app/components/stages/SceneSplitStage.vue'
import { useProjectStore } from '../../../app/stores/project'
import type { DbProjectSettings } from '../../../app/types/database.types'

function makeScene(id: string, index: number) {
  return {
    id,
    project_id: 'p1',
    job_id: null,
    scene_index: index,
    title: `Scene ${index}`,
    script_text: 'text',
    start_time: index * 5,
    end_time: index * 5 + 5,
    duration: 5,
    order_index: index,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeSettings(overrides: Partial<DbProjectSettings> = {}): DbProjectSettings {
  return {
    id: 's1',
    project_id: 'p1',
    prompt_edit_mode: 'after_generation',
    default_image_model: null,
    default_audio_model: null,
    default_video_model: null,
    default_music_model: null,
    timeline_density: null,
    default_script_provider: 'gemini',
    default_image_provider: null,
    default_audio_provider: null,
    default_video_provider: null,
    default_script_model: 'gemini-3-flash',
    skip_video_gen: false,
    target_duration_seconds: 30,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('prompt-generation jobs use the Script tab provider/model', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('ImageStage sends the Script provider/model on "Generate all prompts"', async () => {
    const scenes = [makeScene('s1', 0)]
    const jobPostCalls: unknown[] = []
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string; body?: unknown }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/image-prompts') return []
      if (url === '/api/images') return []
      if (url === '/api/jobs' && opts?.method === 'POST') {
        jobPostCalls.push(opts.body)
        return { id: 'job-1', status: 'queued' }
      }
      if (url.startsWith('/api/jobs/')) return { id: 'job-1', status: 'queued', job_outputs: [] }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const projectStore = useProjectStore()
    projectStore.settings = makeSettings()

    const wrapper = mount(ImageStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const genButton = wrapper.findAll('button').find(b => b.text().includes('Generate all prompts'))!
    await genButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(jobPostCalls).toEqual([
      { projectId: 'p1', type: 'image_prompt', input: { provider: 'gemini', model: 'gemini-3-flash' } },
    ])
  })

  it('VideoStage sends the Script provider/model on "Generate motion prompts"', async () => {
    const scenes = [makeScene('s1', 0)]
    const jobPostCalls: unknown[] = []
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string; body?: unknown }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/video-prompts') return []
      if (url === '/api/videos') return []
      if (url === '/api/image-prompts') return []
      if (url === '/api/images') return []
      if (url === '/api/jobs' && opts?.method === 'POST') {
        jobPostCalls.push(opts.body)
        return { id: 'job-1', status: 'queued' }
      }
      if (url.startsWith('/api/jobs/')) return { id: 'job-1', status: 'queued', job_outputs: [] }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const projectStore = useProjectStore()
    projectStore.settings = makeSettings()

    const wrapper = mount(VideoStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const genButton = wrapper.findAll('button').find(b => b.text().includes('Generate motion prompts'))!
    await genButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(jobPostCalls).toEqual([
      { projectId: 'p1', type: 'video_prompt', input: { provider: 'gemini', model: 'gemini-3-flash' } },
    ])
  })

  it('SceneSplitStage sends the Script provider/model on "Split into scenes"', async () => {
    const jobPostCalls: unknown[] = []
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string; body?: unknown }) => {
      if (url === '/api/scenes') return []
      if (url === '/api/jobs' && opts?.method === 'POST') {
        jobPostCalls.push(opts.body)
        return { id: 'job-1', status: 'queued' }
      }
      if (url.startsWith('/api/jobs/')) return { id: 'job-1', status: 'queued', job_outputs: [] }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const projectStore = useProjectStore()
    projectStore.settings = makeSettings()

    const wrapper = mount(SceneSplitStage, { props: { projectId: 'p1', scriptText: 'Hello world.' } })
    await vi.advanceTimersByTimeAsync(0)

    const genButton = wrapper.findAll('button').find(b => b.text().includes('Split into scenes'))!
    await genButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(jobPostCalls).toEqual([
      {
        projectId: 'p1',
        type: 'scene_split',
        input: { script_text: 'Hello world.', provider: 'gemini', model: 'gemini-3-flash' },
      },
    ])
  })
})
