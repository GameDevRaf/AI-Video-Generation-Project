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

vi.mock('../../../server/worker/lib/supabase', () => ({ adminSupabase: {} }))

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
