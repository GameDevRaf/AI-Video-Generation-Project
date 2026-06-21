import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const publicSubKey = process.env.NUXT_PUBLIC_SUPABASE_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('URL:', supabaseUrl)
console.log('NUXT_PUBLIC_SUPABASE_KEY:', publicSubKey)

if (!supabaseUrl || !publicSubKey) {
  console.error('Missing URL or NUXT_PUBLIC_SUPABASE_KEY')
  process.exit(1)
}

async function run() {
  const supabaseAdmin = createClient(supabaseUrl, serviceKey || '')
  
  // Create a temporary test user
  const email = `test-${Date.now()}@example.com`
  const password = 'TestPassword123!'
  
  console.log(`Creating test user: ${email}`)
  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  
  if (createError) {
    console.error('Error creating user:', createError)
    return
  }
  
  const user = authData.user
  console.log(`User created: ${user.id}`)
  
  // Now initialize a user-scoped supabase client with NUXT_PUBLIC_SUPABASE_KEY
  const supabaseUser = createClient(supabaseUrl, publicSubKey)
  
  // Sign in as the user
  console.log('Signing in...')
  const { data: sessionData, error: signInError } = await supabaseUser.auth.signInWithPassword({
    email,
    password
  })
  
  if (signInError) {
    console.error('Error signing in with NUXT_PUBLIC_SUPABASE_KEY:', signInError)
    // Clean up
    await supabaseAdmin.auth.admin.deleteUser(user.id)
    return
  }
  
  console.log('Signed in successfully.')
  
  console.log('\n--- Testing Projects SELECT (GET) ---')
  const { data: getProjects, error: getProjectsError } = await supabaseUser
    .from('projects')
    .select('*, project_settings(*)')
  
  if (getProjectsError) {
    console.error('GET Projects Error details:', JSON.stringify(getProjectsError, null, 2))
  } else {
    console.log('GET Projects Success:', getProjects)
  }
  
  // Clean up
  console.log('\nCleaning up user...')
  await supabaseAdmin.auth.admin.deleteUser(user.id)
  console.log('Cleanup done.')
}

run().catch(console.error)
