import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{
    prompt_edit_mode?: string
    // provider selections (migration 004)
    default_script_provider?: string
    default_image_provider?: string
    default_audio_provider?: string
    default_video_provider?: string
    // legacy model fields
    default_audio_voice_id?: string
    default_image_model?: string
    default_video_model?: string
    default_audio_model?: string
    default_music_model?: string
  }>(event)

  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, ...body, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    console.error('PATCH /api/settings database error:', error)
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})

