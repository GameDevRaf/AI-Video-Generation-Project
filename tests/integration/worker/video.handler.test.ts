// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockVideoGenerate = vi.fn()
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { video: () => ({ generate: mockVideoGenerate }) },
}))

const mockGetProviderKey = vi.fn().mockResolvedValue('test-api-key')
vi.mock('../../../server/worker/lib/getProviderKey', () => ({
  getProviderKey: mockGetProviderKey,
}))

const mockUpdateJobStatus = vi.fn()
const mockStoreFileOutput = vi.fn().mockResolvedValue({ outputId: 'out-1', storageUrl: 'https://cdn/video.mp4' })
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
  storeTextOutput: vi.fn(),
  storeFileOutput: mockStoreFileOutput,
}))

vi.mock('../../../server/worker/lib/supabase', () => ({ adminSupabase: {} }))

const mockCreateSignedAssetUrl = vi.fn().mockResolvedValue('https://signed/assets/image.png')
vi.mock('../../../server/utils/storage', () => ({ createSignedAssetUrl: mockCreateSignedAssetUrl }))

const VIDEO_BUFFER = Buffer.from('MP4_DATA')

const BASE_JOB = {
  id: 'job-vid-1',
  project_id: 'proj-1',
  user_id: 'user-1',
  provider: null,
  model: null,
}

function mockFetchVideo() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => VIDEO_BUFFER.buffer,
    headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null },
  }))
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('video handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('fetches API key for the resolved provider', async () => {
    mockVideoGenerate.mockResolvedValueOnce({ videoUrl: 'https://cdn/video.mp4' })
    mockFetchVideo()
    const { handleVideoJob } = await import('../../../server/worker/handlers/video')
    await handleVideoJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'Ocean wave' } } as never)
    expect(mockGetProviderKey).toHaveBeenCalledWith('runway', 'user-1')
  })

  it('transitions: queued → waiting_on_provider → completed', async () => {
    mockVideoGenerate.mockResolvedValueOnce({ videoUrl: 'https://cdn/video.mp4' })
    mockFetchVideo()
    const { handleVideoJob } = await import('../../../server/worker/handlers/video')
    await handleVideoJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'Sunset' } } as never)
    const statuses = mockUpdateJobStatus.mock.calls.map((c: unknown[]) => c[1])
    expect(statuses[0]).toBe('waiting_on_provider')
    expect(statuses[statuses.length - 1]).toBe('completed')
  })

  it('downloads the video URL and calls storeFileOutput with type "video"', async () => {
    mockVideoGenerate.mockResolvedValueOnce({ videoUrl: 'https://cdn/video.mp4' })
    mockFetchVideo()
    const { handleVideoJob } = await import('../../../server/worker/handlers/video')
    await handleVideoJob({ ...BASE_JOB, input: { scene_id: 'sc-2', prompt: 'City' } } as never)
    expect(mockStoreFileOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Buffer),
      expect.stringContaining('sc-2'),
      'video',
      'scene_video_sc-2',
      'video/mp4',
      { prompt: 'City' },
    )
  })

  it('marks job completed after success', async () => {
    mockVideoGenerate.mockResolvedValueOnce({ videoUrl: 'https://cdn/video.mp4' })
    mockFetchVideo()
    const { handleVideoJob } = await import('../../../server/worker/handlers/video')
    await handleVideoJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'Mountain' } } as never)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-vid-1', 'completed', expect.anything())
  })

  it('signs a canonical internal image path immediately before provider use', async () => {
    mockVideoGenerate.mockResolvedValueOnce({ videoUrl: 'https://cdn/video.mp4' })
    mockFetchVideo()
    const { handleVideoJob } = await import('../../../server/worker/handlers/video')
    await handleVideoJob({
      ...BASE_JOB,
      input: { scene_id: 'sc-1', prompt: 'Ocean wave', image_path: 'proj-1/images/scene.png' },
    } as never)

    expect(mockCreateSignedAssetUrl).toHaveBeenCalledWith({}, 'proj-1/images/scene.png')
    expect(mockVideoGenerate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://signed/assets/image.png' }))
  })

  it('propagates error from provider', async () => {
    mockVideoGenerate.mockRejectedValueOnce(new Error('Content policy violation'))
    const { handleVideoJob } = await import('../../../server/worker/handlers/video')
    await expect(
      handleVideoJob({ ...BASE_JOB, input: { scene_id: 'sc-1', prompt: 'p' } } as never)
    ).rejects.toThrow('Content policy violation')
  })
})
