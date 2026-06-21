import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adminSupabase } from '../lib/supabase'
import { updateJobStatus } from '../lib/jobs'
import {
  downloadToFile,
  extensionFromUrl,
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

async function getLatestAudioUrl(projectId: string) {
  const { data: job } = await adminSupabase
    .from('jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('type', 'audio')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!job) return null

  const { data: output } = await adminSupabase
    .from('job_outputs')
    .select('storage_url')
    .eq('job_id', job.id)
    .eq('type', 'audio')
    .not('storage_url', 'is', null)
    .limit(1)
    .single()

  return output?.storage_url ?? null
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
  const videoMap = await getLatestSceneVideos(job.project_id, sceneIds)
  const audioUrl = await getLatestAudioUrl(job.project_id)
  const missingVideos = sceneRows.filter(scene => !videoMap.has(scene.id))

  if (missingVideos.length) {
    await updateJobStatus(job.id, 'failed', {
      error_message: `Missing video clips for ${missingVideos.length} scene(s).`,
    })
    return
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'ai-video-export-'))

  try {
    await updateJobStatus(job.id, 'processing', {})

    const normalizedPaths: string[] = []
    for (const scene of sceneRows) {
      const url = videoMap.get(scene.id)!
      const inputPath = join(tempDir, `scene-${scene.order_index}.${extensionFromUrl(url, 'mp4')}`)
      const normalizedPath = join(tempDir, `scene-${scene.order_index}-normalized.mp4`)
      await downloadToFile(url, inputPath)
      await normalizeVideo(inputPath, normalizedPath)
      normalizedPaths.push(normalizedPath)
    }

    const concatListPath = join(tempDir, 'scenes.txt')
    await writeFile(
      concatListPath,
      normalizedPaths
        .map(path => `file '${path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
        .join('\n'),
    )

    const joinedVideoPath = join(tempDir, 'joined.mp4')
    await concatVideos(concatListPath, joinedVideoPath)

    const finalPath = join(tempDir, 'final.mp4')
    if (audioUrl) {
      const audioPath = join(tempDir, `audio.${extensionFromUrl(audioUrl, 'audio')}`)
      await downloadToFile(audioUrl, audioPath)
      await muxAudio(joinedVideoPath, audioPath, finalPath)
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
      total_duration_seconds: totalDuration,
      audio_url: audioUrl,
      output_url: storageUrl,
      scenes: sceneRows.map(scene => ({
        id: scene.id,
        index: scene.order_index,
        title: scene.title,
        script: scene.script_text,
        start_time: scene.start_time,
        end_time: scene.end_time,
        duration: scene.duration,
        video_url: videoMap.get(scene.id) ?? null,
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
        has_audio: !!audioUrl,
        storage_url: storageUrl,
        total_duration_seconds: totalDuration,
      },
    })

    console.log(`[export] Job ${job.id} completed - ${sceneRows.length} scenes`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
