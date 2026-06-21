import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Returns key metadata only â€” never returns encrypted_secret to the client
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, provider, key_name, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})

