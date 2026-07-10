// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('useNotificationsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts empty and prepends new notifications (newest first)', () => {
    const store = useNotificationsStore()
    expect(store.items).toHaveLength(0)
    store.notify({ heading: 'first' })
    store.notify({ heading: 'second' })
    expect(store.items.map(n => n.heading)).toEqual(['second', 'first'])
  })

  it('replaces an existing notification with the same key in place', () => {
    const store = useNotificationsStore()
    store.notify({ key: 'image:s1', heading: 'A' })
    store.notify({ key: 'other', heading: 'B' })
    store.notify({ key: 'image:s1', heading: 'A2' })
    expect(store.items).toHaveLength(2)
    expect(store.items.find(n => n.key === 'image:s1')?.heading).toBe('A2')
  })

  it('dismisses by id and by key', () => {
    const store = useNotificationsStore()
    const id = store.notify({ heading: 'by id' })
    store.notify({ key: 'k1', heading: 'by key' })
    store.dismiss(id)
    expect(store.items.find(n => n.id === id)).toBeUndefined()
    store.dismiss('k1')
    expect(store.items).toHaveLength(0)
  })

  it('clear empties everything', () => {
    const store = useNotificationsStore()
    store.notify({ heading: 'a' })
    store.notify({ heading: 'b' })
    store.clear()
    expect(store.items).toHaveLength(0)
  })

  it('notifyJobError parses status/code/message and adds the scene label to the heading', () => {
    const store = useNotificationsStore()
    store.notifyJobError({
      key: 'image:s1',
      errorMessage: 'Nano Banana (Gemini image) error 429: {"error":{"code":429,"message":"You exceeded your quota","status":"RESOURCE_EXHAUSTED"}}',
      sceneLabel: 'Scene 3',
    })
    const n = store.items[0]!
    expect(n.heading).toBe('RESOURCE_EXHAUSTED · Scene 3')
    expect(n.subheading).toBe('Code: 429')
    expect(n.body).toBe('You exceeded your quota')
  })

  it('notifyJobError falls back to "Generation failed" with no subheading when there is no code', () => {
    const store = useNotificationsStore()
    store.notifyJobError({ errorMessage: 'No active API key found for provider "openai".' })
    const n = store.items[0]!
    expect(n.heading).toBe('Generation failed')
    expect(n.subheading).toBeUndefined()
    expect(n.body).toBe('No active API key found for provider "openai".')
  })

  it('notifySummary uses the message as the heading', () => {
    const store = useNotificationsStore()
    store.notifySummary({ key: 'image-bulk', message: 'Some images failed to generate.' })
    const n = store.items[0]!
    expect(n.heading).toBe('Some images failed to generate.')
    expect(n.subheading).toBeUndefined()
    expect(n.body).toBeUndefined()
  })

  it('retry toggles the retrying flag and invokes onRetry', async () => {
    const store = useNotificationsStore()
    let resolveRetry: () => void = () => {}
    const onRetry = vi.fn(() => new Promise<void>((r) => { resolveRetry = r }))
    const id = store.notify({ key: 'k', heading: 'x', onRetry })

    const p = store.retry(id)
    expect(store.items.find(n => n.id === id)?.retrying).toBe(true)
    resolveRetry()
    await p
    expect(onRetry).toHaveBeenCalledOnce()
    expect(store.items.find(n => n.id === id)?.retrying).toBe(false)
  })
})
