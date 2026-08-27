import { adminSupabase } from './lib/supabase'
import { updateJobStatus } from './lib/jobs'
import { handleScriptJob } from './handlers/script'
import { handleSceneSplitJob } from './handlers/scene_split'
import { handleImagePromptJob } from './handlers/image_prompt'
import { handleImageJob } from './handlers/image'
import { handleAudioJob } from './handlers/audio'
import { handleVideoPromptJob } from './handlers/video_prompt'
import { handleVideoJob } from './handlers/video'
import { handleExportJob } from './handlers/export'
import type { DbJob, JobType } from '../../app/types/database.types'

const POLL_INTERVAL_MS = 3000

const handlers: Record<JobType, (job: DbJob) => Promise<void>> = {
  script: handleScriptJob,
  scene_split: handleSceneSplitJob,
  image_prompt: handleImagePromptJob,
  image: handleImageJob,
  audio: handleAudioJob,
  video_prompt: handleVideoPromptJob,
  video: handleVideoJob,
  music: async (job) => { await updateJobStatus(job.id, 'failed', { error_message: 'Music not yet implemented' }) },
  export: handleExportJob,
  publish: async (job) => { await updateJobStatus(job.id, 'failed', { error_message: 'Publish not yet implemented' }) },
}

async function claimNextJob(): Promise<DbJob | null> {
  const { data: candidates } = await adminSupabase
    .from('jobs')
    .select('*')
    .in('status', ['queued', 'retrying'])
    .order('created_at', { ascending: true })
    .limit(1)

  if (!candidates?.length) return null
  const candidate = candidates[0] as DbJob

  const { data: claimed } = await adminSupabase
    .from('jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', candidate.id)
    .in('status', ['queued', 'retrying'])
    .select()
    .single()

  return claimed as DbJob | null
}

// A provider failure fails the job immediately (one attempt, no
// automatic retry) so a bad key or transient error doesn't silently re-spend
// credits/tokens up to 3 more times before the user ever sees it. The `retrying`
// status is kept in the DB/type union for backwards compatibility (claimNextJob
// still claims rows in that status) but this loop never writes it anymore — the
// only way back to `queued` is POST /api/jobs/:id/retry (server/utils/jobCreation.ts).
// A future bounded auto-retry policy would reintroduce a `retrying` transition here.
export async function processJob(job: DbJob) {
  console.log(`[worker] Processing job ${job.id} (${job.type})`)
  const handler = handlers[job.type as JobType]

  if (!handler) {
    await updateJobStatus(job.id, 'failed', { error_message: `Unknown job type: ${job.type}` })
    return
  }

  try {
    await handler(job)
    console.log(`[worker] Job ${job.id} completed`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[worker] Job ${job.id} failed:`, msg)
    await updateJobStatus(job.id, 'failed', { error_message: msg, retry_count: (job.retry_count ?? 0) + 1 })
  }
}

async function tick() {
  try {
    const job = await claimNextJob()
    if (job) await processJob(job)
  } catch (err) {
    console.error('[worker] tick error:', err instanceof Error ? err.message : err)
  }
}

// Use globalThis so the flag survives Nitro HMR module re-evaluation
export function startWorkerLoop() {
  if ((globalThis as Record<string, unknown>).__workerStarted) return
  ;(globalThis as Record<string, unknown>).__workerStarted = true
  console.log(`[worker] Started — polling every ${POLL_INTERVAL_MS / 1000}s`)
  tick()
  setInterval(tick, POLL_INTERVAL_MS)
}
