// @vitest-environment node
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSignedAssetUrl } from '../../../server/utils/storage'

const supabaseUrl = process.env.SUPABASE_URL
const publicKey = process.env.NUXT_PUBLIC_SUPABASE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasCredentials = Boolean(supabaseUrl && publicKey && serviceRoleKey)

const suite = describe.skipIf(!hasCredentials)

async function supabaseIsReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: publicKey! },
      signal: AbortSignal.timeout(3_000),
    })
    return response.status < 500
  } catch {
    return false
  }
}

suite('Supabase ownership and RLS', () => {
  let admin: SupabaseClient
  let ownerClient: SupabaseClient
  let otherClient: SupabaseClient
  let ownerId: string | undefined
  let otherId: string | undefined
  let projectId: string | undefined
  let storagePath: string | undefined
  let ownerEmail = ''
  let ownerPassword = ''
  let otherEmail = ''
  let otherPassword = ''
  let integrationReady = false

  beforeAll(async () => {
    if (!(await supabaseIsReachable())) {
      throw new Error(
        '[integration] Supabase credentials were provided, but the Supabase REST endpoint is unreachable',
      )
    }
    try {
      admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false } })

      ownerEmail = `rls-owner-${randomUUID()}@example.com`
      ownerPassword = `RlsTest-${randomUUID()}!`
      const owner = await admin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
      })
      if (owner.error || !owner.data.user) throw owner.error ?? new Error('owner user was not created')
      ownerId = owner.data.user.id

      otherEmail = `rls-other-${randomUUID()}@example.com`
      otherPassword = `RlsTest-${randomUUID()}!`
      const other = await admin.auth.admin.createUser({
        email: otherEmail,
        password: otherPassword,
        email_confirm: true,
      })
      if (other.error || !other.data.user) throw other.error ?? new Error('other user was not created')
      otherId = other.data.user.id

      ownerClient = createClient(supabaseUrl!, publicKey!, { auth: { persistSession: false } })
      otherClient = createClient(supabaseUrl!, publicKey!, { auth: { persistSession: false } })

      const ownerSession = await ownerClient.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      })
      if (ownerSession.error) {
        throw new Error('The isolated RLS test requires sign-in credentials for the temporary owner user')
      }
      integrationReady = true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown setup error'
      throw new Error(`[integration] Supabase fixture setup failed: ${message}`)
    }
  })

  afterAll(async () => {
    if (!admin) return
    if (storagePath && ownerClient) await ownerClient.storage.from('assets').remove([storagePath])
    if (projectId) await admin.from('projects').delete().eq('id', projectId)
    if (ownerId) await admin.auth.admin.deleteUser(ownerId)
    if (otherId) await admin.auth.admin.deleteUser(otherId)
  })

  it('allows an owner to read their project and hides it from another user', async ({ skip }) => {
    if (!integrationReady) return skip('Supabase integration service is unavailable')
    const projectName = `RLS test ${randomUUID()}`
    const { data: created, error: createError } = await ownerClient
      .from('projects')
      .insert({ user_id: ownerId, name: projectName, description: null })
      .select('id, user_id, name')
      .single()

    expect(createError).toBeNull()
    projectId = created?.id
    expect(created?.user_id).toBe(ownerId)

    const { data: ownerProjects, error: ownerReadError } = await ownerClient
      .from('projects')
      .select('id, name')
      .eq('id', created!.id)
      .single()

    expect(ownerReadError).toBeNull()
    expect(ownerProjects?.name).toBe(projectName)

    const otherSession = await otherClient.auth.signInWithPassword({
      email: otherEmail,
      password: otherPassword,
    })
    expect(otherSession.error).toBeNull()

    const { data: otherProjects, error: otherReadError } = await otherClient
      .from('projects')
      .select('id')
      .eq('id', created!.id)

    expect(otherReadError).toBeNull()
    expect(otherProjects).toHaveLength(0)
  })

  it('allows only the owner to sign a private asset URL', async ({ skip }) => {
    if (!integrationReady) return skip('Supabase integration service is unavailable')
    if (!projectId) throw new Error('The project fixture was not created')
    storagePath = `${projectId}/images/${randomUUID()}.png`

    const upload = await ownerClient.storage.from('assets').upload(
      storagePath,
      new Uint8Array([137, 80, 78, 71]),
      { contentType: 'image/png', upsert: false },
    )
    expect(upload.error).toBeNull()

    const ownerUrl = await createSignedAssetUrl(ownerClient, storagePath)
    expect(ownerUrl).not.toContain('/object/public/')
    expect(ownerUrl).toContain('token=')

    const otherUrl = await otherClient.storage.from('assets').createSignedUrl(storagePath, 3600)
    expect(otherUrl.error).toBeTruthy()
  })
})
