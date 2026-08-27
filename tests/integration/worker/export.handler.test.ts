// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── fs/promises mock ──────────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn().mockResolvedValue('/tmp/test-export'),
  readFile: vi.fn().mockResolvedValue(Buffer.from('FINAL_MP4')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}))

// ── ffmpeg utilities mock ─────────────────────────────────────────────────────

const mockRunFfmpeg = vi.fn().mockResolvedValue(undefined)
const mockGetFileDurationSeconds = vi.fn()
const mockDownloadToFile = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../server/utils/ffmpeg', () => ({
  runFfmpeg: mockRunFfmpeg,
  downloadToFile: mockDownloadToFile,
  extensionFromUrl: vi.fn((_url: string, fallback: string) => fallback),
  getFileDurationSeconds: mockGetFileDurationSeconds,
}))

// ── jobs mock ─────────────────────────────────────────────────────────────────

const mockUpdateJobStatus = vi.fn()
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
}))

const signedUrls: Record<string, string> = {
  'proj-1/videos/v1.mp4': 'https://cdn/v1.mp4',
  'proj-1/videos/v2.mp4': 'https://cdn/v2.mp4',
  'proj-1/images/i1.png': 'https://cdn/i1.png',
  'proj-1/images/i2.png': 'https://cdn/i2.png',
  'proj-1/audio/a1.mp3': 'https://cdn/a1.mp3',
  'proj-1/audio/a2.mp3': 'https://cdn/a2.mp3',
  'proj-1/audio/voice.mp3': 'https://cdn/voice.mp3',
}
const mockCreateSignedAssetUrl = vi.fn(async (_client: unknown, path: string) => signedUrls[path] ?? `https://signed.test/${path}`)
vi.mock('../../../server/utils/storage', () => ({
  createSignedAssetUrl: mockCreateSignedAssetUrl,
}))

// ── adminSupabase mock ────────────────────────────────────────────────────────

// Builds a fluent Supabase query chain that resolves to `result` when awaited
// or when `.single()` is called.
function chain(result: unknown) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'like', 'not', 'order', 'limit', 'insert', 'update', 'upsert']) {
    b[m] = vi.fn().mockReturnValue(b)
  }
  b['single'] = vi.fn().mockResolvedValue(result)
  // Make the builder thenable so `await adminSupabase.from(...).select(...)...` works
  b['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  b['catch'] = (reject: (v: unknown) => unknown) => Promise.resolve(result).catch(reject)
  return b
}

const MOCK_SCENES = [
  { id: 'sc-1', order_index: 0, title: 'Intro', script_text: 'Hello', start_time: 0, end_time: 5, duration: 5 },
  { id: 'sc-2', order_index: 1, title: 'Main', script_text: 'World', start_time: 5, end_time: 10, duration: 5 },
]
const MOCK_VIDEOS = [
  { label: 'scene_video_sc-1', storage_path: 'proj-1/videos/v1.mp4' },
  { label: 'scene_video_sc-2', storage_path: 'proj-1/videos/v2.mp4' },
]
const MOCK_IMAGES = [
  { label: 'scene_image_sc-1', storage_path: 'proj-1/images/i1.png' },
  { label: 'scene_image_sc-2', storage_path: 'proj-1/images/i2.png' },
]
const MOCK_PER_SCENE_AUDIO = [
  { label: 'scene_audio_sc-1', storage_path: 'proj-1/audio/a1.mp3' },
  { label: 'scene_audio_sc-2', storage_path: 'proj-1/audio/a2.mp3' },
]

const mockAdminFrom = vi.fn()
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null })

vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: {
    get from() { return mockAdminFrom },
    storage: {
      from: () => ({ upload: mockStorageUpload }),
    },
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_JOB = { id: 'job-exp-1', project_id: 'proj-1', user_id: 'user-1' }

/** Wire up adminSupabase.from() calls for a typical export run.
 *  job_outputs is called up to 4 times in order:
 *   1. getLatestSceneVideos/getLatestSceneImages → videos or images (depending on skipVideoGen)
 *   2. getSceneAudioPaths  → perSceneAudio
 *   3. getVoiceTrackPath   → voiceTrack (only reached if perSceneAudio is incomplete)
 *   4+ insert calls        → insertResult
 */
function setupFromMock({
  perSceneAudio = [] as unknown[],
  voiceTrack = null as { storage_path: string } | null,
  skipVideoGen = false,
  images = MOCK_IMAGES as unknown[],
} = {}) {
  let jobOutputsCall = 0
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === 'scenes') return chain({ data: MOCK_SCENES, error: null })
    if (table === 'project_settings') return chain({ data: { skip_video_gen: skipVideoGen }, error: null })
    if (table === 'job_outputs') {
      jobOutputsCall++
      if (jobOutputsCall === 1) return chain({ data: skipVideoGen ? images : MOCK_VIDEOS, error: null })
      if (jobOutputsCall === 2) return chain({ data: perSceneAudio, error: null })
      if (jobOutputsCall === 3) return chain({ data: voiceTrack, error: null }) // voice_track fallback
      return chain({ data: null, error: null }) // insert calls
    }
    if (table === 'exports') return chain({ data: null, error: null })
    if (table === 'projects') return chain({ data: null, error: null })
    return chain({ data: null, error: null })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('export handler — audio source selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: durations are equal so no freeze needed
    mockGetFileDurationSeconds.mockResolvedValue(10)
  })

  it('concatenates per-scene audio when all scenes have scene_audio_ outputs', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    // runFfmpeg should have been called with a concat command for audio
    const concatAudioCall = mockRunFfmpeg.mock.calls.find((args: string[][]) =>
      args[0]?.includes('-f') && args[0]?.includes('concat') && args[0]?.some(a => a.includes('audio-export')),
    )
    expect(concatAudioCall).toBeDefined()
  })

  it('falls back to voice_track when per-scene audio is missing for some scenes', async () => {
    // Only sc-1 has audio — sc-2 is missing
    const partialAudio = [{ label: 'scene_audio_sc-1', storage_path: 'proj-1/audio/a1.mp3' }]
    setupFromMock({
      perSceneAudio: partialAudio,
      voiceTrack: { storage_path: 'proj-1/audio/voice.mp3' },
    })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    // voice_track should have been downloaded (downloadToFile called with the voice_track URL)
    expect(mockDownloadToFile).toHaveBeenCalledWith('https://cdn/voice.mp3', expect.any(String))
  })

  it('marks job failed and skips export when no audio of any kind exists', async () => {
    setupFromMock({ perSceneAudio: [], voiceTrack: null })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    // Without audio the export still completes (audio is optional)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-exp-1', 'completed', expect.anything())
    // No muxAudio ffmpeg call — only normalise, concat, and finalise calls
    const tpadCall = mockRunFfmpeg.mock.calls.find((args: string[][]) =>
      args[0]?.some(a => typeof a === 'string' && a.includes('tpad')),
    )
    expect(tpadCall).toBeUndefined()
  })
})

describe('export handler — freeze-frame failsafe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('freeze-extends video when audio is longer than video by more than 0.5s', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO })
    // Video = 8s, audio = 12s → should pad 4s
    mockGetFileDurationSeconds
      .mockResolvedValueOnce(8)   // joinedVideoPath
      .mockResolvedValueOnce(12)  // audioFilePath
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    const tpadCall = mockRunFfmpeg.mock.calls.find((args: string[][]) =>
      args[0]?.some(a => typeof a === 'string' && a.includes('tpad=stop_mode=clone')),
    )
    expect(tpadCall).toBeDefined()
    // The stop_duration should be approximately 4 seconds
    const tpadArg = tpadCall?.[0].find((a: string) => a.includes('tpad=stop_mode=clone'))
    expect(tpadArg).toMatch(/stop_duration=4\./)
  })

  it('does not freeze-extend when audio and video durations are within 0.5s', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO })
    // Video = 10s, audio = 10.3s — within tolerance
    mockGetFileDurationSeconds
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10.3)
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    const tpadCall = mockRunFfmpeg.mock.calls.find((args: string[][]) =>
      args[0]?.some(a => typeof a === 'string' && a.includes('tpad=stop_mode=clone')),
    )
    expect(tpadCall).toBeUndefined()
  })

  it('does not freeze-extend when video is longer than audio', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO })
    // Video = 15s, audio = 10s — video is longer, -shortest handles it
    mockGetFileDurationSeconds
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(10)
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    const tpadCall = mockRunFfmpeg.mock.calls.find((args: string[][]) =>
      args[0]?.some(a => typeof a === 'string' && a.includes('tpad=stop_mode=clone')),
    )
    expect(tpadCall).toBeUndefined()
  })

  it('marks job completed after successful export', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO })
    mockGetFileDurationSeconds.mockResolvedValue(10)
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-exp-1', 'completed', expect.anything())
  })

  it('marks job failed when scene videos are missing', async () => {
    // Only one video but two scenes
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'scenes') return chain({ data: MOCK_SCENES, error: null })
      if (table === 'job_outputs') return chain({ data: [MOCK_VIDEOS[0]], error: null })
      return chain({ data: null, error: null })
    })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-exp-1', 'failed', expect.objectContaining({
      error_message: expect.stringContaining('Missing video'),
    }))
  })

  it('normalizes generated scene videos to the shared 1080x1920 vertical format', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO, skipVideoGen: false })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    const normalizeCalls = mockRunFfmpeg.mock.calls.filter((args: string[][]) =>
      args[0]?.includes('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1'),
    )
    expect(normalizeCalls).toHaveLength(2)
    for (const [args] of normalizeCalls) {
      expect(args).toContain('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1')
    }
  })
})

describe('export handler — Skip Video Gen (images-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFileDurationSeconds.mockResolvedValue(10)
  })

  it('uses generated video clips (not images) when skip_video_gen is disabled', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO, skipVideoGen: false })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    expect(mockDownloadToFile).toHaveBeenCalledWith('https://cdn/v1.mp4', expect.any(String))
    expect(mockDownloadToFile).not.toHaveBeenCalledWith('https://cdn/i1.png', expect.any(String))
    // No single-frame seed extraction (image path) should occur
    const seedCall = mockRunFfmpeg.mock.calls.find((args: string[][]) => args[0]?.includes('-frames:v'))
    expect(seedCall).toBeUndefined()
  })

  it('downloads scene images and builds a slideshow when skip_video_gen is enabled', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO, skipVideoGen: true })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    // Images downloaded instead of videos
    expect(mockDownloadToFile).toHaveBeenCalledWith('https://cdn/i1.png', expect.any(String))
    expect(mockDownloadToFile).toHaveBeenCalledWith('https://cdn/i2.png', expect.any(String))
    expect(mockDownloadToFile).not.toHaveBeenCalledWith('https://cdn/v1.mp4', expect.any(String))

    // Each image is seeded to a single-frame clip...
    const seedCalls = mockRunFfmpeg.mock.calls.filter((args: string[][]) => args[0]?.includes('-frames:v'))
    expect(seedCalls).toHaveLength(2)
    for (const [args] of seedCalls) {
      expect(args).toContain('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1')
    }

    // ...then held for the scene's full duration (5s, from MOCK_SCENES) via the same
    // tpad freeze-frame extend used for the video-generation failsafe.
    const tpadCalls = mockRunFfmpeg.mock.calls.filter((args: string[][]) =>
      args[0]?.some(a => typeof a === 'string' && a.includes('tpad=stop_mode=clone')),
    )
    const holdCalls = tpadCalls.filter((args: string[][]) => {
      const arg = args[0].find((a: string) => a.includes('tpad=stop_mode=clone'))
      return arg?.includes('stop_duration=5.000')
    })
    expect(holdCalls).toHaveLength(2)

    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-exp-1', 'completed', expect.objectContaining({
      output_summary: expect.objectContaining({ mode: 'images_only' }),
    }))
  })

  it('marks job failed when scene images are missing and skip_video_gen is enabled', async () => {
    // Only one image but two scenes
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO, skipVideoGen: true, images: [MOCK_IMAGES[0]!] })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-exp-1', 'failed', expect.objectContaining({
      error_message: expect.stringContaining('Missing images'),
    }))
  })

  it('still combines per-scene audio as normal in images-only mode', async () => {
    setupFromMock({ perSceneAudio: MOCK_PER_SCENE_AUDIO, skipVideoGen: true })
    const { handleExportJob } = await import('../../../server/worker/handlers/export')
    await handleExportJob(BASE_JOB as never)

    const concatAudioCall = mockRunFfmpeg.mock.calls.find((args: string[][]) =>
      args[0]?.includes('-f') && args[0]?.includes('concat') && args[0]?.some(a => a.includes('audio-export')),
    )
    expect(concatAudioCall).toBeDefined()
  })
})
