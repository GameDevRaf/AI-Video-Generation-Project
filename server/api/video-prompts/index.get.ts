import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

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

  // Query job_outputs directly (by label prefix) so single-scene regenerations
  // don't drop other scenes' prompts — mirrors the image-prompts endpoint.
  const { data: outputs } = await supabase
    .from('job_outputs')
    .select('id, label, metadata')
    .eq('project_id', projectId)
    .like('label', 'video_prompt_scene_%')
    .order('created_at', { ascending: false })

  // Deduplicate: newest prompt per scene wins
  const seen = new Set<string>()
  const result: { sceneId: string; outputId: string; prompt: string }[] = []

  for (const o of outputs ?? []) {
    const sceneId = o.label?.replace('video_prompt_scene_', '') ?? ''
    if (!sceneId || seen.has(sceneId)) continue
    seen.add(sceneId)
    result.push({
      sceneId,
      outputId: o.id,
      prompt: (o.metadata as { content?: string } | null)?.content ?? '',
    })
  }

  return result
})

