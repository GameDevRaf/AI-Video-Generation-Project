import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const outputId = getRouterParam(event, 'outputId')
  const { prompt } = await readBody<{ prompt: string }>(event)

  const supabase = await serverSupabaseClient(event)

  const { data: output } = await supabase
    .from('job_outputs')
    .select('id, jobs!inner(user_id)')
    .eq('id', outputId)
    .single()

  const ownerUserId = (output?.jobs as unknown as { user_id: string } | null)?.user_id
  if (!output || ownerUserId !== user.id) {
    throw createError({ statusCode: 403, message: 'Not found' })
  }

  const { data, error } = await supabase
    .from('job_outputs')
    .update({ metadata: { content: prompt } })
    .eq('id', outputId)
    .select('id')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
