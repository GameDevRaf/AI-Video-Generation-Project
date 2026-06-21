import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const projectId = getRouterParam(event, 'id')
  const body = await readBody<{
    prompt_edit_mode?: string
    default_image_model?: string
    default_audio_model?: string
    default_video_model?: string
    default_music_model?: string
    timeline_density?: string
  }>(event)

  const supabase = await serverSupabaseClient(event)

  // Verify project belongs to user
  const { error: ownerErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (ownerErr) throw createError({ statusCode: 403, message: 'Forbidden' })

  const { data, error } = await supabase
    .from('project_settings')
    .upsert({ project_id: projectId, ...body, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
