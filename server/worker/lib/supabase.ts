import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

// Service-role client — bypasses RLS, only used inside the worker process
export const adminSupabase = createClient(url, key, {
  auth: { persistSession: false },
})
