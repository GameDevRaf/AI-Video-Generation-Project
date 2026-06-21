import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Returns the latest image prompt for every scene in a project.
// Queries job_outputs directly so that single-scene regenerations don't
// overwrite other scenes' prompts (label: "image_prompt_scene_{scene_id}").
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

  // Fetch all image-prompt outputs for this project, newest first.
  // job_outputs carries project_id so no job join is needed.
  const { data: outputs } = await supabase
    .from('job_outputs')
    .select('id, label, metadata')
    .eq('project_id', projectId)
    .like('label', 'image_prompt_scene_%')
    .order('created_at', { ascending: false })

  // Deduplicate: newest prompt per scene wins
  const seen = new Set<string>()
  const result: { sceneId: string; outputId: string; prompt: string }[] = []

  for (const o of outputs ?? []) {
    const sceneId = o.label?.replace('image_prompt_scene_', '') ?? ''
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
