import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Returns generated video URLs keyed by scene_id.
// Reads from job_outputs directly (label: "scene_video_{scene_id}").
// If the user regenerated a scene's video, the newest one wins.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { projectId } = getQuery(event) as { projectId?: string }
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  const supabase = await serverSupabaseClient(event)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  const { data } = await supabase
    .from('job_outputs')
    .select('label, storage_url, metadata, created_at')
    .eq('project_id', projectId)
    .eq('type', 'video')
    .like('label', 'scene_video_%')
    .order('created_at', { ascending: false })

  // Deduplicate: newest video per scene_id
  const seen = new Set<string>()
  const result: { sceneId: string; url: string; generationPrompt: string; createdAt: string }[] = []

  for (const row of data ?? []) {
    const sceneId = row.label?.replace('scene_video_', '') ?? ''
    if (!sceneId || seen.has(sceneId) || !row.storage_url) continue
    seen.add(sceneId)
    result.push({
      sceneId,
      url: row.storage_url,
      generationPrompt: (row.metadata as { prompt?: string } | null)?.prompt ?? '',
      createdAt: row.created_at,
    })
  }

  return result
})
