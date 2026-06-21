import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Returns the script text from the most recent scene_split job for a project.
// Used to restore workspace.activeScriptText when reopening a project.
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

  // The scene_split job input always contains the full script text the user locked in.
  // Pick the most recent one regardless of status so we always get the latest attempt.
  const { data: job } = await supabase
    .from('jobs')
    .select('input')
    .eq('project_id', projectId)
    .eq('type', 'scene_split')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const text = (job?.input as { script_text?: string } | null)?.script_text ?? null
  return { text }
})
