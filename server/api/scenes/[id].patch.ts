import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody<{
    script_text?: string
    title?: string
    duration?: number
    start_time?: number
    end_time?: number
    order_index?: number
  }>(event)

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

  const { data, error } = await supabase
    .from('scenes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
