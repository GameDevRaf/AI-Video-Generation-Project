// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ASSETS_BUCKET, ASSET_SIGNED_URL_TTL_SECONDS, createSignedAssetUrl } from '../../../server/utils/storage'

describe('createSignedAssetUrl', () => {
  it('requests a one-hour signed URL from the private assets bucket', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/asset' }, error: null })
    const from = vi.fn().mockReturnValue({ createSignedUrl })
    const supabase = { storage: { from } } as never

    await expect(createSignedAssetUrl(supabase, 'project/images/scene.png')).resolves.toBe('https://signed.example/asset')
    expect(from).toHaveBeenCalledWith(ASSETS_BUCKET)
    expect(createSignedUrl).toHaveBeenCalledWith('project/images/scene.png', ASSET_SIGNED_URL_TTL_SECONDS)
  })

  it('passes through a shorter expiry when a caller needs an explicit expiry', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/short' }, error: null })
    const supabase = { storage: { from: () => ({ createSignedUrl }) } } as never

    await expect(createSignedAssetUrl(supabase, 'project/images/scene.png', 1)).resolves.toBe('https://signed.example/short')
    expect(createSignedUrl).toHaveBeenCalledWith('project/images/scene.png', 1)
  })

  it('throws when Supabase cannot create the signed URL', async () => {
    const supabase = {
      storage: {
        from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }),
      },
    } as never

    await expect(createSignedAssetUrl(supabase, 'project/images/scene.png')).rejects.toThrow('Storage signed URL failed: denied')
  })

  it('rejects an empty storage path before calling Supabase', async () => {
    const supabase = { storage: { from: vi.fn() } } as never
    await expect(createSignedAssetUrl(supabase, '')).rejects.toThrow('storage path is required')
  })
})
