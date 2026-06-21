import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

// Accepts an ordered array of scene ids and updates each order_index + recalculated timestamps
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{
    projectId: string
    scenes: { id: string; order_index: number; start_time: number; end_time: number; duration: number }[]
  }>(event)

  if (!body.projectId || !Array.isArray(body.scenes)) {
    throw createError({ statusCode: 400, message: 'projectId and scenes array required' })
  }

  const supabase = await serverSupabaseClient(event)

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', body.projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  // Update each scene â€” Supabase doesn't support bulk update natively so we run them in parallel
  await Promise.all(
    body.scenes.map(s =>
      supabase
        .from('scenes')
        .update({
          order_index: s.order_index,
          start_time: s.start_time,
          end_time: s.end_time,
          duration: s.duration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', s.id)
        .eq('project_id', body.projectId),
    ),
  )

  return { success: true }
})

