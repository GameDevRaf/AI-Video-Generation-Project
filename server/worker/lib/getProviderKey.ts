import { adminSupabase } from './supabase'
import { decrypt } from '../../utils/crypto'

/**
 * Fetches the most recently added active API key for `provider` / `userId`,
 * decrypts it, and returns the plaintext secret.
 * Throws a user-friendly error if no active key exists.
 */
export async function getProviderKey(provider: string, userId: string): Promise<string> {
  const { data, error } = await adminSupabase
    .from('api_keys')
    .select('encrypted_secret')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error(
      `No active API key found for provider "${provider}". Add one in Settings → API Keys.`,
    )
  }

  return decrypt(data.encrypted_secret)
}
