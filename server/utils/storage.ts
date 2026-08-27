import type { SupabaseClient } from '@supabase/supabase-js'

export const ASSETS_BUCKET = 'assets'
export const ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60

/** Returns a time-limited URL for an asset path the caller is authorized to read. */
export async function createSignedAssetUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn = ASSET_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  if (!storagePath) throw new Error('storage path is required')

  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data?.signedUrl) {
    throw new Error(`Storage signed URL failed: ${error?.message ?? 'no URL returned'}`)
  }

  return data.signedUrl
}
