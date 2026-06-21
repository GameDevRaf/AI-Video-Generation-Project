import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const projectId = query.projectId as string | undefined
  const type = query.type as string | undefined

  const supabase = await serverSupabaseClient(event)

  let q = supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (projectId) q = q.eq('project_id', projectId)
  if (type) q = q.eq('type', type)

  const { data, error } = await q

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})

