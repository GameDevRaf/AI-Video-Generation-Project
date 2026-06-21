import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

// Returns the latest image prompts for every scene in a project.
// Looks for the most recent completed image_prompt job and maps its outputs to scene ids.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { projectId } = getQuery(event) as { projectId?: string }
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  const supabase = await serverSupabaseClient(event)

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  // Get the latest completed image_prompt job
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('type', 'image_prompt')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!job) return []

  const { data: outputs } = await supabase
    .from('job_outputs')
    .select('id, label, metadata')
    .eq('job_id', job.id)
    .like('label', 'image_prompt_scene_%')

  // Shape: [{ sceneId, outputId, prompt }]
  return (outputs ?? []).map(o => ({
    sceneId: o.label!.replace('image_prompt_scene_', ''),
    outputId: o.id,
    prompt: (o.metadata as { content?: string } | null)?.content ?? '',
  }))
})
