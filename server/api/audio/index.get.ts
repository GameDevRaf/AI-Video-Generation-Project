import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Returns the latest completed audio output for a project
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { projectId } = getQuery(event) as { projectId?: string }
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  const supabase = await serverSupabaseClient(event)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  const { data: job } = await supabase
    .from('jobs')
    .select('id, input')
    .eq('project_id', projectId)
    .eq('type', 'audio')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!job) return null

  const { data: output } = await supabase
    .from('job_outputs')
    .select('storage_url, metadata')
    .eq('job_id', job.id)
    .eq('type', 'audio')
    .limit(1)
    .single()

  if (!output?.storage_url) return null

  return {
    url: output.storage_url,
    jobInput: job.input,
  }
})
