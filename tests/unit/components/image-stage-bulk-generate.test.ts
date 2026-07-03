// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ImageStage from '../../../app/components/stages/ImageStage.vue'

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

describe('ImageStage — Generate All Images', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stays disabled while jobs are processing, blocks re-clicks, and refreshes previews without a tab switch once jobs complete', async () => {
    const scenes = [makeScene('s1', 0), makeScene('s2', 1)]
    const jobStatus: Record<string, string> = {}
    let jobSeq = 0
    let imagesReady = false

    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/image-prompts') {
        return scenes.map(s => ({ sceneId: s.id, outputId: `out-${s.id}`, prompt: `prompt for ${s.id}` }))
      }
      if (url === '/api/images') {
        if (!imagesReady) return []
        return scenes.map(s => ({ sceneId: s.id, url: `https://cdn.test/${s.id}.png`, generationPrompt: `prompt for ${s.id}` }))
      }
      if (url === '/api/jobs' && opts?.method === 'POST') {
        jobSeq += 1
        const id = `job-${jobSeq}`
        jobStatus[id] = 'queued'
        return { id, status: 'queued' }
      }
      if (url.startsWith('/api/jobs/')) {
        const id = url.split('/').pop()!
        return { id, status: jobStatus[id] }
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mount(ImageStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const findGenAllButton = () => wrapper.findAll('button').find(b =>
      b.text().includes('Generate all images')
      || b.text().includes('Regenerate all images')
      || b.text().includes('Generating images'),
    )!

    // Idle state: enabled, since prompts exist and neither image has been generated yet.
    expect(findGenAllButton().attributes('disabled')).toBeUndefined()
    expect(findGenAllButton().text()).toContain('Generate all images')

    await findGenAllButton().trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    // Both jobs submitted; button must now show the loading state and be disabled.
    expect(findGenAllButton().text()).toContain('Generating images…')
    expect(findGenAllButton().attributes('disabled')).toBeDefined()

    const postCallsAfterFirstClick = fetchMock.mock.calls.filter(c => c[0] === '/api/jobs' && c[1]?.method === 'POST').length
    expect(postCallsAfterFirstClick).toBe(2)

    // Re-clicking while jobs are still processing must be a no-op — no duplicate jobs.
    await findGenAllButton().trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    const postCallsAfterSecondClick = fetchMock.mock.calls.filter(c => c[0] === '/api/jobs' && c[1]?.method === 'POST').length
    expect(postCallsAfterSecondClick).toBe(2)

    // Simulate the worker finishing both jobs, then let the store's poller pick that up.
    imagesReady = true
    for (const id of Object.keys(jobStatus)) jobStatus[id] = 'completed'
    await vi.advanceTimersByTimeAsync(2100)

    // Previews must reflect the generated images without navigating away and back.
    expect(wrapper.html()).toContain('https://cdn.test/s1.png')
    expect(wrapper.html()).toContain('https://cdn.test/s2.png')

    // Button must be re-enabled, and now reads "Regenerate" since every scene has an image.
    expect(findGenAllButton().attributes('disabled')).toBeUndefined()
    expect(findGenAllButton().text()).toContain('Regenerate all images')

    // Clicking again must still submit jobs (regenerate), not silently no-op just because
    // every scene already has an image.
    await findGenAllButton().trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    const postCallsAfterRegenerateClick = fetchMock.mock.calls.filter(c => c[0] === '/api/jobs' && c[1]?.method === 'POST').length
    expect(postCallsAfterRegenerateClick).toBe(4)
    expect(findGenAllButton().text()).toContain('Generating images…')
  })
})
