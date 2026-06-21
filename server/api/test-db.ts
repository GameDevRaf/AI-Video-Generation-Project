import { serverSupabaseClient } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_settings(*)')
      .limit(1)

    return {
      success: !error,
      data,
      error
    }
  } catch (e) {
    return {
      success: false,
      catchError: e instanceof Error ? { message: e.message, stack: e.stack } : e
    }
  }
})

