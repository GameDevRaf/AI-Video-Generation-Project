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

  return createJobWithDedup(supabase, user.id, {
    projectId: body.projectId,
    type: body.type,
    input: body.input,
    provider: body.provider,
    model: body.model,
  })
})
