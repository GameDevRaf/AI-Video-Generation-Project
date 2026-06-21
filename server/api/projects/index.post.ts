import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{ name: string; description?: string }>(event)
  if (!body.name?.trim()) throw createError({ statusCode: 400, message: 'Project name is required' })

  const supabase = await serverSupabaseClient(event)

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: body.name.trim(), description: body.description ?? null })
    .select()
    .single()

  if (projectError) throw createError({ statusCode: 500, message: projectError.message })

  // Create default settings row
  await supabase.from('project_settings').insert({ project_id: project.id })

  return project
})
