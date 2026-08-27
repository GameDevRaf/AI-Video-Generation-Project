import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import { createSignedAssetUrl } from '../../utils/storage'

// Returns the latest voice_track audio output for a project.
// Queries job_outputs directly by label so it finds tracks created by single-job
// generation, per-scene combine, or direct upload — regardless of job type.
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

  const { data: output } = await supabase
    .from('job_outputs')
    .select('storage_path, metadata, created_at')
    .eq('project_id', projectId)
    .eq('type', 'audio')
    .eq('label', 'voice_track')
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!output?.storage_path) return null

  const sceneSnapshot = (output.metadata as { scene_snapshot?: { id: string; script_text: string }[] } | null)
    ?.scene_snapshot ?? null

  return {
    url: await createSignedAssetUrl(supabase, output.storage_path),
    sceneSnapshot,
    createdAt: output.created_at,
  }
})
