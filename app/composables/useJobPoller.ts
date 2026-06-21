import { useIntervalFn } from '@vueuse/core'
import type { DbJob, DbJobOutput } from '~/types/database.types'

export type JobWithOutputs = DbJob & { job_outputs: DbJobOutput[] }

export function useJobPoller() {
  const job = ref<JobWithOutputs | null>(null)
  const polling = ref(false)
  const starting = ref(false)
  const error = ref<string | null>(null)

  const { pause, resume } = useIntervalFn(async () => {
    if (!job.value?.id) return
    try {
      const updated = await $fetch<JobWithOutputs>(`/api/jobs/${job.value.id}`)
      job.value = updated
      if (updated.status === 'completed' || updated.status === 'failed') {
        pause()
        polling.value = false
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Polling error'
      pause()
      polling.value = false
    }
  }, 2000, { immediate: false })

  async function startJob(projectId: string, type: string, input: Record<string, unknown>) {
    // Drop concurrent calls — the button should be disabled by isRunning, but guard
    // against the async gap between click and polling becoming true.
    if (starting.value || polling.value) return
    starting.value = true
    error.value = null
    job.value = null

    try {
      const created = await $fetch<JobWithOutputs>('/api/jobs', {
        method: 'POST',
        body: { projectId, type, input },
      })
      job.value = created
      polling.value = true
      resume()
      return created
    } finally {
      starting.value = false
    }
  }

  function reset() {
    pause()
    job.value = null
    polling.value = false
    starting.value = false
    error.value = null
  }

  const isRunning = computed(() =>
    starting.value
    || polling.value
    || job.value?.status === 'queued'
    || job.value?.status === 'processing',
  )
  const isDone = computed(() => job.value?.status === 'completed')
  const isFailed = computed(() => job.value?.status === 'failed')

  return { job, polling, isRunning, isDone, isFailed, error, startJob, reset }
}
