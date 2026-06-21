import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('projects')
    .select('*, project_settings(*)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('GET /api/projects database error:', error)
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
