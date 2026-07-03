import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { projectId } = await readBody<{ projectId?: string }>(event)
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  const supabase = await serverSupabaseClient(event)

  // Verify project ownership before creating a scene
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  const { count } = await supabase
    .from('scenes')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const nextIndex = count ?? 0

  const { data, error } = await supabase
    .from('scenes')
    .insert({
      project_id: projectId,
      scene_index: nextIndex,
      order_index: nextIndex,
      title: null,
      script_text: '',
      duration: 5,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
