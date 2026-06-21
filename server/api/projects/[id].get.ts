import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('projects')
    .select('*, project_settings(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw createError({ statusCode: 404, message: 'Project not found' })

  return data
})
