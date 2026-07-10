import { defineStore } from 'pinia'
import { parseJobError } from '../../shared/utils/parseJobError'

export interface ToastNotification {
  id: string
  /** Stable identity for dedupe + targeted dismiss, e.g. 'image:<sceneId>', 'audio-bulk'. */
  key?: string
  heading: string
  subheading?: string
  body?: string
  onRetry?: () => void | Promise<void>
  retrying?: boolean
}

let idSeq = 0

/**
 * Global toast notifications, currently used for generation-job failures across
 * every pipeline stage. Persistent by design: a toast is only removed when the
 * user dismisses it, or when the workspace page clears them on tab switch /
 * project exit (see app/pages/workspace/[projectId].vue).
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<ToastNotification[]>([])

  /** Add a toast, or replace an existing one with the same `key` (in place). */
  function notify(payload: Omit<ToastNotification, 'id'>): string {
    const id = `toast-${++idSeq}`
    const entry: ToastNotification = { ...payload, id, retrying: false }
    if (payload.key) {
      const idx = items.value.findIndex(n => n.key === payload.key)
      if (idx !== -1) {
        items.value.splice(idx, 1, entry)
        return id
      }
    }
    items.value = [entry, ...items.value]
    return id
  }

  /** Build a parsed single-job error toast (status heading / Code subheading / message body). */
  function notifyJobError(opts: {
    key?: string
    errorMessage: string
    sceneLabel?: string
    onRetry?: () => void | Promise<void>
  }): string {
    const { status, code, message } = parseJobError(opts.errorMessage)
    const heading = (status ?? 'Generation failed') + (opts.sceneLabel ? ` · ${opts.sceneLabel}` : '')
    return notify({
      key: opts.key,
      heading,
      subheading: code !== undefined ? `Code: ${code}` : undefined,
      body: message,
      onRetry: opts.onRetry,
    })
  }

  /** Build a bulk/summary toast that reuses an existing summary string as the heading. */
  function notifySummary(opts: {
    key?: string
    message: string
    onRetry?: () => void | Promise<void>
  }): string {
    return notify({ key: opts.key, heading: opts.message, onRetry: opts.onRetry })
  }

  /** Remove a toast by id or by key. */
  function dismiss(idOrKey: string) {
    items.value = items.value.filter(n => n.id !== idOrKey && n.key !== idOrKey)
  }

  function clear() {
    items.value = []
  }

  /** Invoke a toast's retry action, toggling its `retrying` spinner state. */
  async function retry(id: string) {
    const entry = items.value.find(n => n.id === id)
    if (!entry?.onRetry || entry.retrying) return
    entry.retrying = true
    try {
      await entry.onRetry()
    } finally {
      // The item may have been replaced (failed again → same key) or removed
      // (succeeded → dismissed); only reset if it's still the same instance.
      const still = items.value.find(n => n.id === id)
      if (still) still.retrying = false
    }
  }

  return { items, notify, notifyJobError, notifySummary, dismiss, clear, retry }
})
