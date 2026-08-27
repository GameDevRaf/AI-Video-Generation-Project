import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import type { JobType } from '~/types/database.types'
import { createJobWithDedup } from '../../utils/jobCreation'

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

  // Queued video jobs must carry a durable path, not an expiring signed URL.
  // Verify the path through the user's RLS-scoped client before the worker's
  // service-role client is allowed to sign it later.
  const imagePath = body.type === 'video' ? body.input?.image_path : undefined
  if (imagePath !== undefined) {
    if (typeof imagePath !== 'string' || !imagePath) {
      throw createError({ statusCode: 400, message: 'image_path must be a non-empty storage path' })
    }
    const { data: imageOutput, error: imageError } = await supabase
      .from('job_outputs')
      .select('id')
      .eq('project_id', body.projectId)
      .eq('type', 'image')
      .eq('storage_path', imagePath)
      .limit(1)
      .maybeSingle()

    if (imageError) throw createError({ statusCode: 500, message: imageError.message })
    if (!imageOutput) throw createError({ statusCode: 400, message: 'image_path is not an asset in this project' })
  }

  return createJobWithDedup(supabase, user.id, {
    projectId: body.projectId,
    type: body.type,
    input: body.input,
    provider: body.provider,
    model: body.model,
  })
})
