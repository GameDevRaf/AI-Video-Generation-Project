import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

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

  if (projectError) {
    console.error('POST /api/projects database error:', projectError)
    throw createError({ statusCode: 500, message: projectError.message })
  }

  // Create default settings row
  const { error: settingsError } = await supabase.from('project_settings').insert({ project_id: project.id })
  if (settingsError) {
    console.error('POST /api/projects settings insert error:', settingsError)
    throw createError({ statusCode: 500, message: settingsError.message })
  }

  return project
})

