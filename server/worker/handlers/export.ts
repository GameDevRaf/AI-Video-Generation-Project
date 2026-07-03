import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adminSupabase } from '../lib/supabase'
import { updateJobStatus } from '../lib/jobs'
import {
  downloadToFile,
  extensionFromUrl,
  getFileDurationSeconds,
  runFfmpeg,
} from '../../utils/ffmpeg'
import type { DbJob } from '../../../app/types/database.types'

interface SceneRow {
  id: string
  order_index: number
  title: string | null
  script_text: string
  start_time: number | null
  end_time: number | null
  duration: number | null
}

interface OutputRow {
  label: string | null
  storage_url: string | null
}

async function getLatestSceneVideos(projectId: string, sceneIds: string[]) {
  const { data } = await adminSupabase
    .from('job_outputs')
    .select('label, storage_url')
    .eq('project_id', projectId)
    .eq('type', 'video')
    .like('label', 'scene_video_%')
    .not('storage_url', 'is', null)
    .order('created_at', { ascending: false })

  const wanted = new Set(sceneIds)
  const videoMap = new Map<string, string>()
  for (const row of (data ?? []) as OutputRow[]) {
    const sceneId = row.label?.replace('scene_video_', '') ?? ''
    if (!sceneId || !wanted.has(sceneId) || videoMap.has(sceneId) || !row.storage_url) continue
    videoMap.set(sceneId, row.storage_url)
  }
  return videoMap
}

async function getLatestSceneImages(projectId: string, sceneIds: string[]) {
  const { data } = await adminSupabase
    .from('job_outputs')
    .select('label, storage_url')
    .eq('project_id', projectId)
    .eq('type', 'image')
    .like('label', 'scene_image_%')
    .not('storage_url', 'is', null)
    .order('created_at', { ascending: false })

  const wanted = new Set(sceneIds)
  const imageMap = new Map<string, string>()
  for (const row of (data ?? []) as OutputRow[]) {
    const sceneId = row.label?.replace('scene_image_', '') ?? ''
    if (!sceneId || !wanted.has(sceneId) || imageMap.has(sceneId) || !row.storage_url) continue
    imageMap.set(sceneId, row.storage_url)
  }
  return imageMap
}

// Skip Video Gen: when enabled, export assembles a slideshow from scene images instead of
// generated video clips. Toggled on the Video tab and read here at export time.
async function getSkipVideoGen(projectId: string): Promise<boolean> {
  const { data } = await adminSupabase
    .from('project_settings')
    .select('skip_video_gen')
    .eq('project_id', projectId)
    .single()
  return !!data?.skip_video_gen
}

// Returns latest per-scene audio URLs (scene_audio_{sceneId}).
async function getSceneAudioUrls(projectId: string, sceneIds: string[]): Promise<Map<string, string>> {
  const { data } = await adminSupabase
    .from('job_outputs')
    .select('label, storage_url')
    .eq('project_id', projectId)
    .eq('type', 'audio')
    .like('label', 'scene_audio_%')
    .not('storage_url', 'is', null)
    .order('created_at', { ascending: false })

  const wanted = new Set(sceneIds)
  const audioMap = new Map<string, string>()
  for (const row of (data ?? []) as OutputRow[]) {
    const sceneId = row.label?.replace('scene_audio_', '') ?? ''
    if (!sceneId || !wanted.has(sceneId) || audioMap.has(sceneId) || !row.storage_url) continue
    audioMap.set(sceneId, row.storage_url)
  }
  return audioMap
}

// Returns the latest single voice_track URL (upload or combined output).
async function getVoiceTrackUrl(projectId: string): Promise<string | null> {
  const { data } = await adminSupabase
    .from('job_outputs')
    .select('storage_url')
    .eq('project_id', projectId)
    .eq('type', 'audio')
    .eq('label', 'voice_track')
    .not('storage_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data?.storage_url ?? null
}

// Resolves the audio to use for export.
// Prefers concatenated per-scene audio (most accurate timing).
// Falls back to a single voice_track (upload or legacy generation).
// Returns a local temp file path ready for ffmpeg, or null if no audio.
async function getAudioForExport(
  projectId: string,
  sceneRows: SceneRow[],
  tempDir: string,
): Promise<string | null> {
  const sceneIds = sceneRows.map(s => s.id)
  const audioMap = await getSceneAudioUrls(projectId, sceneIds)

  if (sceneIds.every(id => audioMap.has(id))) {
    // All scenes have per-scene audio — download and concatenate
    const audioPaths: string[] = []
    for (const scene of sceneRows) {
      const url = audioMap.get(scene.id)!
      const ext = extensionFromUrl(url, 'mp3')
      const path = join(tempDir, `audio-scene-${scene.order_index}.${ext}`)
      await downloadToFile(url, path)
      audioPaths.push(path)
    }

    const audioListPath = join(tempDir, 'audio-scenes.txt')
    await writeFile(
      audioListPath,
      audioPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
    )
    const combinedPath = join(tempDir, 'audio-export.mp3')
    await runFfmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', audioListPath,
      '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2',
      combinedPath,
    ])
    return combinedPath
  }

  // Fall back to single voice_track
  const voiceUrl = await getVoiceTrackUrl(projectId)
  if (!voiceUrl) return null
  const ext = extensionFromUrl(voiceUrl, 'mp3')
  const audioPath = join(tempDir, `audio.${ext}`)
  await downloadToFile(voiceUrl, audioPath)
  return audioPath
}

async function normalizeVideo(inputPath: string, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-i', inputPath,
    '-map', '0:v:0',
    '-an',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
    '-r', '30',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ])
}

async function concatVideos(listPath: string, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ])
}

async function muxAudio(videoPath: string, audioPath: string, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ])
}

async function finalizeVideo(videoPath: string, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ])
}

// Extends the last frame of a video to fill a duration gap.
async function freezeExtendVideo(inputPath: string, extraSeconds: number, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-i', inputPath,
    '-vf', `tpad=stop_mode=clone:stop_duration=${extraSeconds.toFixed(3)}`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-an',
    outputPath,
  ])
}

// Skip Video Gen: turns a still scene image into a normalized clip held for the scene's
// full duration. Reuses the freeze-frame tpad extend below — seed a single-frame clip
// from the image, then hold it exactly like the video-generation freeze-frame failsafe.
async function imageToVideoClip(imagePath: string, durationSeconds: number, seedPath: string, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-i', imagePath,
    '-frames:v', '1',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    seedPath,
  ])
  await freezeExtendVideo(seedPath, durationSeconds, outputPath)
}

export async function handleExportJob(job: DbJob) {
  console.log(`[export] Job ${job.id} - assembling project ${job.project_id}`)

  const { data: scenes, error: scenesErr } = await adminSupabase
    .from('scenes')
    .select('id, order_index, title, script_text, start_time, end_time, duration')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (scenesErr || !scenes?.length) {
    await updateJobStatus(job.id, 'failed', { error_message: 'No scenes found for project.' })
    return
  }

  const sceneRows = scenes as SceneRow[]
  const sceneIds = sceneRows.map(s => s.id)

  // Skip Video Gen: assemble from scene images instead of generated video clips.
  const skipVideoGen = await getSkipVideoGen(job.project_id)
  const mediaMap = skipVideoGen
    ? await getLatestSceneImages(job.project_id, sceneIds)
    : await getLatestSceneVideos(job.project_id, sceneIds)
  const missingMedia = sceneRows.filter(scene => !mediaMap.has(scene.id))

  if (missingMedia.length) {
    await updateJobStatus(job.id, 'failed', {
      error_message: skipVideoGen
        ? `Missing images for ${missingMedia.length} scene(s).`
        : `Missing video clips for ${missingMedia.length} scene(s).`,
    })
    return
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'ai-video-export-'))

  try {
    await updateJobStatus(job.id, 'processing', {})

    // Normalize each scene to a consistent 1280x720 @ 30fps clip — either the generated
    // video, or (Skip Video Gen) the scene image held for its full scene duration.
    const normalizedPaths: string[] = []
    for (const scene of sceneRows) {
      const url = mediaMap.get(scene.id)!
      const normalizedPath = join(tempDir, `scene-${scene.order_index}-normalized.mp4`)

      if (skipVideoGen) {
        const inputPath = join(tempDir, `scene-${scene.order_index}.${extensionFromUrl(url, 'png')}`)
        const seedPath = join(tempDir, `scene-${scene.order_index}-seed.mp4`)
        await downloadToFile(url, inputPath)
        await imageToVideoClip(inputPath, scene.duration ?? 5, seedPath, normalizedPath)
      } else {
        const inputPath = join(tempDir, `scene-${scene.order_index}.${extensionFromUrl(url, 'mp4')}`)
        await downloadToFile(url, inputPath)
        await normalizeVideo(inputPath, normalizedPath)
      }

      normalizedPaths.push(normalizedPath)
    }

    // Concatenate normalized clips
    const concatListPath = join(tempDir, 'scenes.txt')
    await writeFile(
      concatListPath,
      normalizedPaths
        .map(path => `file '${path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
        .join('\n'),
    )
    const joinedVideoPath = join(tempDir, 'joined.mp4')
    await concatVideos(concatListPath, joinedVideoPath)

    // Resolve audio (per-scene concat or single voice_track)
    const audioFilePath = await getAudioForExport(job.project_id, sceneRows, tempDir)

    const finalPath = join(tempDir, 'final.mp4')

    if (audioFilePath) {
      // Compare durations. If audio is longer than video, freeze-extend the last frame
      // so the final cut matches the full audio length instead of cutting scenes short.
      const videoDur = await getFileDurationSeconds(joinedVideoPath)
      const audioDur = await getFileDurationSeconds(audioFilePath)

      let videoForMux = joinedVideoPath
      if (audioDur > videoDur + 0.5) {
        const paddedPath = join(tempDir, 'padded.mp4')
        await freezeExtendVideo(joinedVideoPath, audioDur - videoDur, paddedPath)
        videoForMux = paddedPath
        console.log(`[export] Audio (${audioDur.toFixed(2)}s) > video (${videoDur.toFixed(2)}s) — extended last frame by ${(audioDur - videoDur).toFixed(2)}s`)
      }

      await muxAudio(videoForMux, audioFilePath, finalPath)
    } else {
      await finalizeVideo(joinedVideoPath, finalPath)
    }

    const outputBuffer = await readFile(finalPath)
    const storagePath = `${job.project_id}/exports/${job.id}.mp4`
    const { error: uploadError } = await adminSupabase.storage
      .from('assets')
      .upload(storagePath, outputBuffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) {
      await updateJobStatus(job.id, 'failed', { error_message: `Storage upload failed: ${uploadError.message}` })
      return
    }

    const { data: urlData } = adminSupabase.storage.from('assets').getPublicUrl(storagePath)
    const storageUrl = urlData.publicUrl
    const totalDuration = sceneRows.reduce((sum, scene) => sum + (scene.duration ?? 0), 0)
    const manifest = {
      version: 2,
      project_id: job.project_id,
      exported_at: new Date().toISOString(),
      mode: skipVideoGen ? 'images_only' : 'video',
      total_duration_seconds: totalDuration,
      has_audio: !!audioFilePath,
      output_url: storageUrl,
      scenes: sceneRows.map(scene => ({
        id: scene.id,
        index: scene.order_index,
        title: scene.title,
        script: scene.script_text,
        start_time: scene.start_time,
        end_time: scene.end_time,
        duration: scene.duration,
        video_url: skipVideoGen ? null : mediaMap.get(scene.id) ?? null,
        image_url: skipVideoGen ? mediaMap.get(scene.id) ?? null : null,
      })),
    }

    const { error: outputErr } = await adminSupabase
      .from('job_outputs')
      .insert({
        job_id: job.id,
        project_id: job.project_id,
        type: 'video',
        label: 'final_export_mp4',
        storage_url: storageUrl,
        storage_path: storagePath,
        mime_type: 'video/mp4',
        metadata: manifest,
      })

    if (outputErr) {
      await updateJobStatus(job.id, 'failed', { error_message: `Output insert failed: ${outputErr.message}` })
      return
    }

    await adminSupabase.from('exports').insert({
      project_id: job.project_id,
      job_id: job.id,
      export_type: 'mp4',
      storage_url: storageUrl,
      metadata: { manifest },
    })

    await adminSupabase
      .from('projects')
      .update({ status: 'completed', current_stage: 'export', updated_at: new Date().toISOString() })
      .eq('id', job.project_id)

    await updateJobStatus(job.id, 'completed', {
      completed_at: new Date().toISOString(),
      output_summary: {
        scene_count: sceneRows.length,
        has_audio: !!audioFilePath,
        storage_url: storageUrl,
        total_duration_seconds: totalDuration,
        mode: skipVideoGen ? 'images_only' : 'video',
      },
    })

    console.log(`[export] Job ${job.id} completed - ${sceneRows.length} scenes`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
