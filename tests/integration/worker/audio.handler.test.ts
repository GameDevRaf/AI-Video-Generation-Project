// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockAudioGenerate = vi.fn()
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { audio: () => ({ generate: mockAudioGenerate }) },
}))

const mockGetProviderKey = vi.fn().mockResolvedValue('test-api-key')
vi.mock('../../../server/worker/lib/getProviderKey', () => ({
  getProviderKey: mockGetProviderKey,
}))

const mockUpdateJobStatus = vi.fn()
const mockStoreFileOutput = vi.fn().mockResolvedValue({ outputId: 'out-1', storageUrl: 'https://cdn/audio.mp3' })
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
  storeTextOutput: vi.fn(),
  storeFileOutput: mockStoreFileOutput,
}))

const mockSceneUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) })
vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: {
    from: vi.fn(() => ({ update: mockSceneUpdate })),
  },
}))

vi.mock('../../../server/utils/ffmpeg', () => ({
  getBufferDurationSeconds: vi.fn().mockResolvedValue(3.5),
}))

const AUDIO_BUFFER = Buffer.from('MP3_DATA')

const BASE_JOB = {
  id: 'job-aud-1',
  project_id: 'proj-1',
  user_id: 'user-1',
  provider: null,
  model: null,
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('audio handler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches API key for the resolved provider', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Hello world' } } as never)
    expect(mockGetProviderKey).toHaveBeenCalledWith('elevenlabs', 'user-1')
  })

  it('transitions to waiting_on_provider then completed', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Narrate this' } } as never)
    const statuses = mockUpdateJobStatus.mock.calls.map((c: unknown[]) => c[1])
    expect(statuses[0]).toBe('waiting_on_provider')
    expect(statuses[statuses.length - 1]).toBe('completed')
  })

  it('calls storeFileOutput with type "audio"', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Hello' } } as never)
    expect(mockStoreFileOutput).toHaveBeenCalledWith(
      expect.anything(),
      AUDIO_BUFFER,
      expect.stringContaining('.mp3'),
      'audio',
      'voice_track',
      'audio/mpeg',
      expect.objectContaining({ duration: expect.any(Number) }),
    )
  })

  it('uses .wav extension for audio/wav mimeType', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/wav' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Hello' } } as never)
    const storagePath = mockStoreFileOutput.mock.calls[0][2]
    expect(storagePath).toMatch(/\.wav$/)
  })

  it('propagates error from provider', async () => {
    mockAudioGenerate.mockRejectedValueOnce(new Error('Voice not found'))
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await expect(
      handleAudioJob({ ...BASE_JOB, input: { script_text: 'Hi' } } as never)
    ).rejects.toThrow('Voice not found')
  })
})

// ── Per-scene generation ───────────────────────────────────────────────────────

describe('audio handler — per-scene generation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses scene_audio_{sceneId} label when scene_id is provided', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Line 1', scene_id: 'sc-42' } } as never)
    const label = mockStoreFileOutput.mock.calls[0][4]
    expect(label).toBe('scene_audio_sc-42')
  })

  it('uses voice_track label when no scene_id', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Full script' } } as never)
    const label = mockStoreFileOutput.mock.calls[0][4]
    expect(label).toBe('voice_track')
  })

  it('stores duration in metadata for per-scene audio', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Line 2', scene_id: 'sc-1' } } as never)
    const metadata = mockStoreFileOutput.mock.calls[0][6] as { duration: number; scene_id: string }
    expect(metadata.duration).toBe(3.5)   // value returned by mocked getBufferDurationSeconds
    expect(metadata.scene_id).toBe('sc-1')
  })

  it('updates scene duration in DB when scene_id is provided', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Line 3', scene_id: 'sc-7' } } as never)
    expect(mockSceneUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 3.5 }),
    )
  })

  it('does not update scene in DB when no scene_id', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Whole script' } } as never)
    expect(mockSceneUpdate).not.toHaveBeenCalled()
  })

  it('includes scene_id in completed output_summary', async () => {
    mockAudioGenerate.mockResolvedValueOnce({ audioBuffer: AUDIO_BUFFER, mimeType: 'audio/mpeg' })
    const { handleAudioJob } = await import('../../../server/worker/handlers/audio')
    await handleAudioJob({ ...BASE_JOB, input: { script_text: 'Scene text', scene_id: 'sc-3' } } as never)
    const completedCall = mockUpdateJobStatus.mock.calls.find((c: unknown[]) => c[1] === 'completed')
    expect(completedCall?.[2]).toMatchObject({ output_summary: { scene_id: 'sc-3', duration_seconds: 3.5 } })
  })
})
