import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

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

  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('type', 'video_prompt')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!job) return []

  const { data: outputs } = await supabase
    .from('job_outputs')
    .select('id, label, metadata')
    .eq('job_id', job.id)
    .like('label', 'video_prompt_scene_%')

  return (outputs ?? []).map(o => ({
    sceneId: o.label!.replace('video_prompt_scene_', ''),
    outputId: o.id,
    prompt: (o.metadata as { content?: string } | null)?.content ?? '',
  }))
})
