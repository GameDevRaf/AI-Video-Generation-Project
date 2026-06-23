import { serverSupabaseUser, serverSupabaseClient } from '~~/supabase-server'
import { adminSupabase } from '../../worker/lib/supabase'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const outputId = getRouterParam(event, 'outputId')
  const { prompt } = await readBody<{ prompt: string }>(event)

  const { data: output } = await adminSupabase
    .from('job_outputs')
    .select('id, project_id')
    .eq('id', outputId)
    .single()

  if (!output?.project_id) throw createError({ statusCode: 404, message: 'Not found' })

  const supabase = await serverSupabaseClient(event)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', output.project_id)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Not found' })

  const { error } = await adminSupabase
    .from('job_outputs')
    .update({ metadata: { content: prompt } })
    .eq('id', outputId)

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { id: outputId }
})
