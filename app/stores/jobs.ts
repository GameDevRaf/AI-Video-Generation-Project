import { defineStore } from 'pinia'
import type { DbJob } from '~/types/database.types'

export const useJobsStore = defineStore('jobs', () => {
  // Reactive map: jobId → job record
  const activeJobs = ref<Record<string, DbJob>>({})
  // Non-reactive: jobId → interval handle
  const pollers = new Map<string, ReturnType<typeof setInterval>>()

  // ── Queries ──

  function getJob(id: string): DbJob | undefined {
    return activeJobs.value[id]
  }

  function getLatestByType(projectId: string, type: string): DbJob | undefined {
    return Object.values(activeJobs.value)
      .filter(j => j.project_id === projectId && j.type === type)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  }

  function isRunning(projectId: string, type: string): boolean {
    const job = getLatestByType(projectId, type)
    return job?.status === 'processing' || job?.status === 'queued' || job?.status === 'retrying'
  }

  // ── Mutations ──

  function track(job: DbJob) {
    activeJobs.value = { ...activeJobs.value, [job.id]: job }
  }

  // ── Actions ──

  async function createJob(
    projectId: string,
    type: string,
    input: Record<string, unknown>,
  ): Promise<DbJob> {
    const job = await $fetch<DbJob>('/api/jobs', {
      method: 'POST',
      body: { projectId, type, input },
    })
    track(job)
    return job
  }

  async function retryJob(
    failedJobId: string,
    overrides?: { provider?: string; model?: string; input?: Record<string, unknown> },
  ): Promise<DbJob> {
    const job = await $fetch<DbJob>(`/api/jobs/${failedJobId}/retry`, {
      method: 'POST',
      body: overrides ?? {},
    })
    track(job)
    return job
  }

  function startPolling(id: string, onDone?: (job: DbJob) => void) {
    if (pollers.has(id)) return
    const handle = setInterval(async () => {
      try {
        const job = await $fetch<DbJob>(`/api/jobs/${id}`)
        track(job)
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(handle)
          pollers.delete(id)
          onDone?.(job)
        }
      } catch {
        // Swallow transient network errors; let the interval retry
      }
    }, 2000)
    pollers.set(id, handle)
  }

  function cancelPoll(id: string) {
    const handle = pollers.get(id)
    if (handle) {
      clearInterval(handle)
      pollers.delete(id)
    }
  }

  function cancelAll() {
    for (const handle of pollers.values()) clearInterval(handle)
    pollers.clear()
    activeJobs.value = {}
  }

  return {
    activeJobs,
    getJob,
    getLatestByType,
    isRunning,
    track,
    createJob,
    retryJob,
    startPolling,
    cancelPoll,
    cancelAll,
  }
})
