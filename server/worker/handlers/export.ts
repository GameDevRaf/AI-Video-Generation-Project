import { adminSupabase } from '../lib/supabase'
import { updateJobStatus } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

export async function handleExportJob(job: DbJob) {
  console.log(`[export] Job ${job.id} — assembling project ${job.project_id}`)

  // 1. Fetch all scenes in order
  const { data: scenes, error: scenesErr } = await adminSupabase
    .from('scenes')
    .select('id, order_index, title, script_text, start_time, end_time, duration')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (scenesErr || !scenes?.length) {
    await updateJobStatus(job.id, 'failed', { error_message: 'No scenes found for project.' })
    return
  }

  // 2. For each scene, collect its generated video asset (if any)
  const sceneIds = scenes.map(s => s.id)

  const { data: videoAssets } = await adminSupabase
    .from('scene_assets')
    .select('scene_id, job_outputs(storage_url)')
    .eq('role', 'generated_video')
    .in('scene_id', sceneIds)

  const videoMap = new Map(
    (videoAssets ?? []).map(a => [
      a.scene_id,
      (a.job_outputs as unknown as { storage_url: string } | null)?.storage_url ?? null,
    ]),
  )

  // 3. Collect the audio track (if any)
  const { data: audioJob } = await adminSupabase
    .from('jobs')
    .select('id')
    .eq('project_id', job.project_id)
    .eq('type', 'audio')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let audioUrl: string | null = null
  if (audioJob) {
    const { data: audioOutput } = await adminSupabase
      .from('job_outputs')
      .select('storage_url')
      .eq('job_id', audioJob.id)
      .eq('type', 'audio')
      .limit(1)
      .single()
    audioUrl = audioOutput?.storage_url ?? null
  }

  // 4. Build the video manifest (MVP — swap with ffmpeg concatenation when ready)
  const totalDuration = scenes.reduce((s, sc) => s + (sc.duration ?? 0), 0)
  const manifest = {
    version: 1,
    project_id: job.project_id,
    exported_at: new Date().toISOString(),
    total_duration_seconds: totalDuration,
    audio_url: audioUrl,
    scenes: scenes.map(sc => ({
      index: sc.order_index,
      title: sc.title,
      script: sc.script_text,
      start_time: sc.start_time,
      end_time: sc.end_time,
      duration: sc.duration,
      video_url: videoMap.get(sc.id) ?? null,
    })),
    assembly_note:
      'To produce a final MP4: download each scene video and the audio track, then concatenate ' +
      'with ffmpeg: ffmpeg -f concat -safe 0 -i scenes.txt -i audio.mp3 -c copy output.mp4',
  }

  // 5. Store manifest as a job_output (type: json)
  const { data: output, error: outputErr } = await adminSupabase
    .from('job_outputs')
    .insert({
      job_id: job.id,
      project_id: job.project_id,
      type: 'json',
      label: 'export_manifest',
      metadata: manifest,
    })
    .select('id')
    .single()

  if (outputErr) {
    await updateJobStatus(job.id, 'failed', { error_message: `Output insert failed: ${outputErr.message}` })
    return
  }

  // 6. Record in exports table
  await adminSupabase.from('exports').insert({
    project_id: job.project_id,
    job_id: job.id,
    export_type: 'manifest',
    metadata: { output_id: output.id, scene_count: scenes.length, total_duration_seconds: totalDuration },
  })

  // 7. Mark project as completed
  await adminSupabase
    .from('projects')
    .update({ status: 'completed', current_stage: 'export', updated_at: new Date().toISOString() })
    .eq('id', job.project_id)

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { scene_count: scenes.length, has_audio: !!audioUrl, total_duration_seconds: totalDuration },
  })

  console.log(`[export] Job ${job.id} completed — ${scenes.length} scenes, ${totalDuration}s`)
}
