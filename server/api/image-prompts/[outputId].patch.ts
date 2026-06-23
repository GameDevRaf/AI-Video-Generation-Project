import { serverSupabaseUser } from '~~/supabase-server'
import { adminSupabase } from '../../worker/lib/supabase'
import { serverSupabaseClient } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const outputId = getRouterParam(event, 'outputId')
  const { prompt } = await readBody<{ prompt: string }>(event)

  // Fetch the output record without RLS so we can read by plain ID.
  const { data: output } = await adminSupabase
    .from('job_outputs')
    .select('id, project_id')
    .eq('id', outputId)
    .single()

  if (!output?.project_id) throw createError({ statusCode: 404, message: 'Not found' })

  // Verify the authenticated user owns the project — use user client so RLS enforces this.
  const supabase = await serverSupabaseClient(event)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', output.project_id)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Not found' })

  // Update with the admin client (user client RLS blocks UPDATE on job_outputs).
  const { error } = await adminSupabase
    .from('job_outputs')
    .update({ metadata: { content: prompt } })
    .eq('id', outputId)

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { id: outputId }
})
