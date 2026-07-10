// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import NotificationHost from '../../../app/components/NotificationHost.vue'

describe('NotificationHost', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders heading, subheading, and body for a seeded notification', async () => {
    const store = useNotificationsStore()
    store.notify({ heading: 'RESOURCE_EXHAUSTED · Scene 3', subheading: 'Code: 429', body: 'You exceeded your quota' })

    const wrapper = mount(NotificationHost, { attachTo: document.body })
    await nextTick()

    // Teleported to body — assert against the document, not the wrapper root.
    const toast = document.body.querySelector('[data-testid="toast-notification"]')!
    expect(toast).toBeTruthy()
    expect(toast.textContent).toContain('RESOURCE_EXHAUSTED · Scene 3')
    expect(toast.textContent).toContain('Code: 429')
    expect(toast.textContent).toContain('You exceeded your quota')
    wrapper.unmount()
  })

  it('shows no Retry button when the notification has no onRetry', async () => {
    const store = useNotificationsStore()
    store.notify({ heading: 'Some images failed to generate.' })
    const wrapper = mount(NotificationHost, { attachTo: document.body })
    await nextTick()
    expect(document.body.querySelector('[data-testid="toast-retry"]')).toBeNull()
    wrapper.unmount()
  })

  it('clicking the x dismisses the notification', async () => {
    const store = useNotificationsStore()
    store.notify({ heading: 'oops' })
    const wrapper = mount(NotificationHost, { attachTo: document.body })
    await nextTick()

    const dismiss = document.body.querySelector('[data-testid="toast-dismiss"]') as HTMLButtonElement
    dismiss.click()
    await nextTick()
    expect(store.items).toHaveLength(0)
    wrapper.unmount()
  })

  it('clicking Retry invokes onRetry and shows the retrying state', async () => {
    const store = useNotificationsStore()
    let resolveRetry: () => void = () => {}
    const onRetry = vi.fn(() => new Promise<void>((r) => { resolveRetry = r }))
    store.notify({ key: 'k', heading: 'failed', onRetry })

    const wrapper = mount(NotificationHost, { attachTo: document.body })
    await nextTick()

    const retryBtn = document.body.querySelector('[data-testid="toast-retry"]') as HTMLButtonElement
    retryBtn.click()
    await nextTick()
    expect(onRetry).toHaveBeenCalledOnce()
    expect(document.body.querySelector('[data-testid="toast-retry"]')!.textContent).toContain('Retrying')

    resolveRetry()
    await nextTick()
    wrapper.unmount()
  })
})
