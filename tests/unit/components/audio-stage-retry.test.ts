// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AudioStage from '../../../app/components/stages/AudioStage.vue'

function makeScene(id: string, index: number) {
  return {
    id, project_id: 'p1', job_id: null, scene_index: index,
    title: `Scene ${index}`, script_text: 'text',
    start_time: index * 5, end_time: index * 5 + 5, duration: 5, order_index: index,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('AudioStage — failures route to a toast notification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('adds a summary toast that retries only the failed scene jobs', async () => {
    const scenes = [makeScene('s1', 0), makeScene('s2', 1)]
    const jobs: Record<string, { status: string; sceneId: string }> = {}
    let jobSeq = 0

    const fetchMock = vi.fn(async (url: string, opts?: { method?: string; body?: unknown }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/audio') return null
      if (url === '/api/jobs' && opts?.method === 'POST') {
        const body = opts.body as { input: { scene_id: string } }
        jobSeq += 1
        const id = `job-${jobSeq}`
        jobs[id] = { status: 'queued', sceneId: body.input.scene_id }
        return { id }
      }
      if (url.endsWith('/retry') && opts?.method === 'POST') {
        const oldId = url.split('/')[3]!
        jobSeq += 1
        const newId = `job-${jobSeq}`
        jobs[newId] = { status: 'queued', sceneId: jobs[oldId]!.sceneId }
        return { id: newId }
      }
      if (url.startsWith('/api/jobs/')) {
        const id = url.split('/').pop()!
        return { status: jobs[id]?.status }
      }
      if (url === '/api/audio/combine' && opts?.method === 'POST') return { url: 'https://cdn.test/voice.mp3' }
      if (url === '/api/scenes/reorder' && opts?.method === 'POST') return { success: true }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const notifications = useNotificationsStore()
    const wrapper = mount(AudioStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const generateButton = wrapper.findAll('button').find(b => b.text().includes('Generate audio'))!
    await generateButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const ids = Object.keys(jobs)
    expect(ids).toHaveLength(2)
    const s1JobId = ids.find(id => jobs[id]!.sceneId === 's1')!
    const s2JobId = ids.find(id => jobs[id]!.sceneId === 's2')!
    jobs[s1JobId]!.status = 'completed'
    jobs[s2JobId]!.status = 'failed'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'audio-bulk')!
    expect(toast).toBeDefined()
    expect(toast.heading).toBe('Audio generation failed for 1 scene(s).')

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith(`/api/jobs/${s2JobId}/retry`, expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/jobs/${s1JobId}/retry`, expect.anything())

    const retriedId = Object.keys(jobs).find(id => !ids.includes(id))!
    jobs[retriedId]!.status = 'completed'
    await vi.advanceTimersByTimeAsync(2100)
    expect(notifications.items.find(n => n.key === 'audio-bulk')).toBeUndefined()
  })
})
