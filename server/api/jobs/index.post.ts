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
