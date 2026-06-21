import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code === 'PGRST116') {
    // Row doesn't exist yet â€” auto-create and return defaults
    const { data: created } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id })
      .select()
      .single()
    return created
  }

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})

