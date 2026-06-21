import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import { encrypt } from '../../utils/crypto'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{ provider: string; secret: string; keyName?: string }>(event)
  if (!body.provider || !body.secret) {
    throw createError({ statusCode: 400, message: 'provider and secret are required' })
  }

  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      provider: body.provider,
      key_name: body.keyName ?? null,
      encrypted_secret: encrypt(body.secret),
      is_active: true,
    })
    .select('id, provider, key_name, is_active, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})

