import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

import { createSignedAssetUrl } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const supabase = await serverSupabaseClient(event)

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, job_outputs(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw createError({ statusCode: 404, message: 'Job not found' })

  type JobOutputRow = Record<string, unknown> & { storage_path?: string | null }
  const outputRows = (job.job_outputs ?? []) as JobOutputRow[]
  const outputs = await Promise.all(outputRows.map(async (output: JobOutputRow) => ({
    ...output,
    storage_url: output.storage_path
      ? await createSignedAssetUrl(supabase, output.storage_path)
      : null,
  })))

  return { ...job, job_outputs: outputs }
})
