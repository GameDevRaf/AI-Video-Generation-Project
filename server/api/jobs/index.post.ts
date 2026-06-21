import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import type { JobType } from '~/types/database.types'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{
    projectId: string
    type: JobType
    input?: Record<string, unknown>
    provider?: string
    model?: string
  }>(event)

  if (!body.projectId || !body.type) {
    throw createError({ statusCode: 400, message: 'projectId and type are required' })
  }

  const supabase = await serverSupabaseClient(event)

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', body.projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  // Deduplication: if a job of the same type (and scene_id if applicable) is already
  // queued or processing, return it instead of creating a duplicate that wastes credits.
  const sceneId = (body.input as Record<string, unknown> | null)?.scene_id as string | null ?? null

  let dedupQuery = supabase
    .from('jobs')
    .select('*')
    .eq('project_id', body.projectId)
    .eq('type', body.type)
    .in('status', ['queued', 'processing'])

  if (sceneId) {
    dedupQuery = dedupQuery.eq('input->>scene_id', sceneId)
  } else {
    dedupQuery = dedupQuery.is('input->>scene_id', null)
  }

  const { data: existingJob } = await dedupQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingJob) return existingJob

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      project_id: body.projectId,
      type: body.type,
      status: 'queued',
      input: body.input ?? null,
      provider: body.provider ?? null,
      model: body.model ?? null,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return job
})
