// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockImageGenerate = vi.fn()
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { image: () => ({ generate: mockImageGenerate }) },
}))

const mockGetProviderKey = vi.fn().mockResolvedValue('test-api-key')
vi.mock('../../../server/worker/lib/getProviderKey', () => ({
  getProviderKey: mockGetProviderKey,
}))

const mockUpdateJobStatus = vi.fn()
const mockStoreFileOutput = vi.fn().mockResolvedValue({ outputId: 'out-1', storageUrl: 'https://cdn/img.png' })
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
  storeTextOutput: vi.fn(),
  storeFileOutput: mockStoreFileOutput,
}))

vi.mock('../../../server/worker/lib/supabase', () => ({ adminSupabase: {} }))

// ── Helpers ────────────────────────────────────────────────────────────────

const IMAGE_PNG = Buffer.from('PNG_DATA')

function mockFetchUrl() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => IMAGE_PNG.buffer,
    headers: { get: (h: string) => h === 'content-type' ? 'image/png' : null },
  }))
}

const BASE_JOB = {
  id: 'job-img-1',
  project_id: 'proj-1',
  user_id: 'user-1',
  provider: null,
  model: null,
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('image handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('fetches API key for the resolved provider', async () => {
    mockImageGenerate.mockResolvedValueOnce({ imageUrl: 'https://cdn/img.png' })
    mockFetchUrl()
    const { handleImageJob } = await import('../../../server/worker/handlers/image')
    await handleImageJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'A cat' } } as never)
    expect(mockGetProviderKey).toHaveBeenCalledWith('fal', 'user-1')
  })

  it('transitions to waiting_on_provider before calling provider', async () => {
    mockImageGenerate.mockResolvedValueOnce({ imageUrl: 'https://cdn/img.png' })
    mockFetchUrl()
    const { handleImageJob } = await import('../../../server/worker/handlers/image')
    await handleImageJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'A cat' } } as never)
    const statuses = mockUpdateJobStatus.mock.calls.map((c: unknown[]) => c[1])
    expect(statuses[0]).toBe('waiting_on_provider')
    expect(statuses[statuses.length - 1]).toBe('completed')
  })

  it('calls storeFileOutput with type "image"', async () => {
    mockImageGenerate.mockResolvedValueOnce({ imageUrl: 'https://cdn/img.png' })
    mockFetchUrl()
    const { handleImageJob } = await import('../../../server/worker/handlers/image')
    await handleImageJob({ ...BASE_JOB, input: { scene_id: 'sc-2', prompt: 'Forest' } } as never)
    expect(mockStoreFileOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Buffer),
      expect.stringContaining('sc-2'),
      'image',
      'scene_image_sc-2',
      'image/png',
      { prompt: 'Forest' },
    )
  })

  it('handles rawBuffer result (Stability AI) without fetching a URL', async () => {
    mockImageGenerate.mockResolvedValueOnce({ rawBuffer: IMAGE_PNG, mimeType: 'image/png' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { handleImageJob } = await import('../../../server/worker/handlers/image')
    await handleImageJob({ ...BASE_JOB, input: { scene_id: 'sc-3', prompt: 'Mountain' } } as never)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockStoreFileOutput).toHaveBeenCalledWith(
      expect.anything(), IMAGE_PNG, expect.anything(), 'image', expect.anything(), 'image/png', expect.any(Object),
    )
  })

  it('marks job completed after success', async () => {
    mockImageGenerate.mockResolvedValueOnce({ imageUrl: 'https://cdn/img.png' })
    mockFetchUrl()
    const { handleImageJob } = await import('../../../server/worker/handlers/image')
    await handleImageJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'Ocean' } } as never)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-img-1', 'completed', expect.anything())
  })

  it('propagates error from provider (worker retry loop handles it)', async () => {
    mockImageGenerate.mockRejectedValueOnce(new Error('Provider quota exceeded'))
    const { handleImageJob } = await import('../../../server/worker/handlers/image')
    await expect(
      handleImageJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'Ocean' } } as never)
    ).rejects.toThrow('Provider quota exceeded')
  })
})
