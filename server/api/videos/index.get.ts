import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

// Returns generated video URLs keyed by scene_id
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

  // Join scene_assets → job_outputs for generated_video assets
  const { data } = await supabase
    .from('scene_assets')
    .select('scene_id, job_outputs(storage_url)')
    .eq('role', 'generated_video')
    .in(
      'scene_id',
      (
        await supabase
          .from('scenes')
          .select('id')
          .eq('project_id', projectId)
      ).data?.map(s => s.id) ?? [],
    )

  return (data ?? []).map(row => ({
    sceneId: row.scene_id,
    url: (row.job_outputs as unknown as { storage_url: string } | null)?.storage_url ?? null,
  })).filter(r => r.url)
})
