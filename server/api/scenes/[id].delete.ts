import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')

  const supabase = await serverSupabaseClient(event)

  // Ownership check via project join
  const { data: scene } = await supabase
    .from('scenes')
    .select('project_id, projects!inner(user_id)')
    .eq('id', id)
    .single()

  const projectUserId = (scene?.projects as unknown as { user_id: string } | null)?.user_id
  if (!scene || projectUserId !== user.id) {
    throw createError({ statusCode: 403, message: 'Scene not found' })
  }

  const { error } = await supabase
    .from('scenes')
    .delete()
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { success: true }
})
