import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import { VIDEO_FORMAT } from '../../../../shared/config/videoFormat'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const projectId = getRouterParam(event, 'id')
  const body = await readBody<{
    prompt_edit_mode?: string
    // migration 004 — per-project provider overrides
    default_script_provider?: string
    default_image_provider?: string
    default_audio_provider?: string
    default_video_provider?: string
    // model fields
    default_script_model?: string
    default_image_model?: string
    default_audio_model?: string
    default_video_model?: string
    default_music_model?: string
    timeline_density?: string
    skip_video_gen?: boolean
    // migration 007 — target video length
    target_duration_seconds?: number
  }>(event)

  if (body.target_duration_seconds !== undefined) {
    body.target_duration_seconds = Math.min(body.target_duration_seconds, VIDEO_FORMAT.maxDuration)
  }

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
    .upsert(
      { project_id: projectId, ...body, updated_at: new Date().toISOString() },
      { onConflict: 'project_id' },
    )
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
