import type { SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import type { DbJob, JobType } from '../../app/types/database.types'

export interface CreateJobInput {
  projectId: string
  type: JobType
  input?: Record<string, unknown> | null
  provider?: string | null
  model?: string | null
}

/**
 * Verifies project ownership, dedupes against any already queued/processing job of the
 * same type (and scene_id, when present), and inserts a new job otherwise. Shared by
 * `POST /api/jobs` and `POST /api/jobs/:id/retry` so both paths dedupe identically.
 */
export async function createJobWithDedup(
  supabase: SupabaseClient,
  userId: string,
  params: CreateJobInput,
): Promise<DbJob> {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', params.projectId)
    .eq('user_id', userId)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  const sceneId = (params.input as Record<string, unknown> | null)?.scene_id as string | null ?? null

  let dedupQuery = supabase
    .from('jobs')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('type', params.type)
    .in('status', ['queued', 'processing'])

  dedupQuery = sceneId
    ? dedupQuery.eq('input->>scene_id', sceneId)
    : dedupQuery.is('input->>scene_id', null)

  const { data: existingJob } = await dedupQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingJob) return existingJob as DbJob

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      user_id: userId,
      project_id: params.projectId,
      type: params.type,
      status: 'queued',
      input: params.input ?? null,
      provider: params.provider ?? null,
      model: params.model ?? null,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return job as DbJob
}

/** Fetches a job owned by `userId`, throwing if missing or not in a retryable (`failed`) state. */
export async function getRetryableJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
): Promise<DbJob> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (error || !job) throw createError({ statusCode: 404, message: 'Job not found' })
  if (job.status !== 'failed') throw createError({ statusCode: 400, message: 'Only failed jobs can be retried' })

  return job as DbJob
}
