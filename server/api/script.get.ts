import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Returns the script text, original idea, and tone for a project.
// Used to restore state when reopening a project that is past the 'script' stage.
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

  // Script text: stored in the scene_split job input when the user locks in a script
  const { data: sceneSplitJob } = await supabase
    .from('jobs')
    .select('input')
    .eq('project_id', projectId)
    .eq('type', 'scene_split')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const text = (sceneSplitJob?.input as { script_text?: string } | null)?.script_text ?? null

  // Idea + tone: stored in the latest script generation job input
  const { data: scriptJob } = await supabase
    .from('jobs')
    .select('input')
    .eq('project_id', projectId)
    .eq('type', 'script')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const idea = (scriptJob?.input as { idea?: string } | null)?.idea ?? null
  const tone = (scriptJob?.input as { tone?: string } | null)?.tone ?? null

  return { text, idea, tone }
})
