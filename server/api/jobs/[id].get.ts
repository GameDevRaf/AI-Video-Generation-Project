import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const supabase = await serverSupabaseClient(event)

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, job_outputs(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw createError({ statusCode: 404, message: 'Job not found' })

  return job
})
