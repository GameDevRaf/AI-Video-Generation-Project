export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (user.value) return

  const supabase = useSupabaseClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session) return navigateTo('/auth/login')
})
