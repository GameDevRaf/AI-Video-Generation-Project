import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import { createJobWithDedup, getRetryableJob } from '../../../utils/jobCreation'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Job id is required' })

  const supabase = await serverSupabaseClient(event)
  const failedJob = await getRetryableJob(supabase, user.id, id)

  const body = await readBody<{
    provider?: string
    model?: string
    input?: Record<string, unknown>
  }>(event).catch(() => ({}) as Record<string, never>)

  // Creates a new job row rather than mutating the failed one, so the failed
  // attempt stays in history. Reuses the failed job's own provider/model/input
  // unless the caller explicitly overrides them (e.g. retrying after switching
  // provider for a "no API key" failure).
  return createJobWithDedup(supabase, user.id, {
    projectId: failedJob.project_id,
    type: failedJob.type,
    input: body.input ?? failedJob.input,
    provider: body.provider ?? failedJob.provider,
    model: body.model ?? failedJob.model,
  })
})
