// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ScriptStage from '../../../app/components/stages/ScriptStage.vue'
import { useProjectStore } from '../../../app/stores/project'
import type { DbProject, DbProjectSettings } from '../../../app/types/database.types'

function makeProject(): DbProject {
  return {
    id: 'p1',
    user_id: 'u1',
    name: 'Test project',
    description: null,
    status: 'active',
    current_stage: 'script',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeSettings(targetDurationSeconds: number): DbProjectSettings {
  return {
    id: 's1',
    project_id: 'p1',
    prompt_edit_mode: 'after_generation',
    default_image_model: null,
    default_audio_model: null,
    default_video_model: null,
    default_music_model: null,
    timeline_density: null,
    default_script_provider: null,
    default_image_provider: null,
    default_audio_provider: null,
    default_video_provider: null,
    default_script_model: null,
    skip_video_gen: false,
    target_duration_seconds: targetDurationSeconds,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('ScriptStage — target length selector', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('persists the selected preset and includes it in the script generation job input', async () => {
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string; body?: unknown }) => {
      if (url === '/api/projects/p1/settings' && opts?.method === 'PATCH') {
        return { ...makeSettings(180), ...(opts.body as object) }
      }
      if (url === '/api/jobs' && opts?.method === 'POST') {
        return { id: 'job-1', status: 'queued' }
      }
      if (url.startsWith('/api/jobs/')) {
        return { id: 'job-1', status: 'queued', job_outputs: [] }
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(180)

    const wrapper = mount(ScriptStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    // Default preset (180s / "3m") should be selected initially.
    const findPreset = (label: string) => wrapper.findAll('button').find(b => b.text() === label)!
    expect(findPreset('3m').classes()).toContain('bg-white')

    await findPreset('60s').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/p1/settings',
      expect.objectContaining({ method: 'PATCH', body: { target_duration_seconds: 60 } }),
    )
    expect(projectStore.settings?.target_duration_seconds).toBe(60)

    await wrapper.get('#idea').setValue('A documentary about cats')
    const generateButton = wrapper.findAll('button').find(b => b.text().includes('Generate scripts'))!
    await generateButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const jobPostCall = fetchMock.mock.calls.find(c => c[0] === '/api/jobs' && (c[1] as { method?: string })?.method === 'POST')
    expect(jobPostCall).toBeDefined()
    const body = jobPostCall![1] as { body: { input: { target_duration_seconds: number } } }
    expect(body.body.input.target_duration_seconds).toBe(60)
  })

  it('defaults to the 30s preset for a new project with no saved settings', async () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = null

    const wrapper = mount(ScriptStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const findPreset = (label: string) => wrapper.findAll('button').find(b => b.text() === label)!
    expect(findPreset('30s').classes()).toContain('bg-white')
  })
})
