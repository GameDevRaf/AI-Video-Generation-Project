import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import { adminSupabase } from '../../worker/lib/supabase'
import { downloadToFile, extensionFromUrl, runFfmpeg } from '../../utils/ffmpeg'

interface AudioOutputRow {
  label: string | null
  storage_url: string | null
}

// Concatenates all per-scene audio files (scene_audio_*) for a project into a
// single voice_track that the AudioPlayer can use. Called by the frontend after
// all per-scene audio jobs complete.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { projectId } = await readBody<{ projectId: string }>(event)
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  const supabase = await serverSupabaseClient(event)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  // Fetch scenes in playback order
  const { data: scenes } = await adminSupabase
    .from('scenes')
    .select('id, order_index, script_text')
    .eq('project_id', projectId)
    .order('order_index')

  if (!scenes?.length) throw createError({ statusCode: 404, message: 'No scenes found' })

  const sceneIds = scenes.map(s => s.id)

  // Fetch latest per-scene audio outputs
  const { data: outputs } = await adminSupabase
    .from('job_outputs')
    .select('label, storage_url')
    .eq('project_id', projectId)
    .eq('type', 'audio')
    .like('label', 'scene_audio_%')
    .not('storage_url', 'is', null)
    .order('created_at', { ascending: false })

  // Build map: sceneId → URL (first = latest per scene)
  const audioMap = new Map<string, string>()
  for (const row of (outputs ?? []) as AudioOutputRow[]) {
    const sceneId = row.label?.replace('scene_audio_', '') ?? ''
    if (sceneId && !audioMap.has(sceneId) && row.storage_url) {
      audioMap.set(sceneId, row.storage_url)
    }
  }

  const missing = sceneIds.filter(id => !audioMap.has(id))
  if (missing.length) {
    throw createError({
      statusCode: 422,
      message: `Missing audio for ${missing.length} scene(s). Generate audio for all scenes first.`,
    })
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'ai-audio-combine-'))

  try {
    // Download each scene's audio in scene order
    const audioPaths: string[] = []
    for (const scene of scenes) {
      const url = audioMap.get(scene.id)!
      const ext = extensionFromUrl(url, 'mp3')
      const path = join(tempDir, `scene-${scene.order_index}.${ext}`)
      await downloadToFile(url, path)
      audioPaths.push(path)
    }

    // Write ffmpeg concat list
    const listPath = join(tempDir, 'audio.txt')
    await writeFile(
      listPath,
      audioPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
    )

    // Concatenate — re-encode to ensure consistent 44100Hz stereo mp3 output
    const combinedPath = join(tempDir, 'combined.mp3')
    await runFfmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2',
      combinedPath,
    ])

    const audioBuffer = await readFile(combinedPath)
    const storageKey = `${projectId}/audio/combined_${Date.now()}.mp3`

    const { error: uploadErr } = await supabase.storage
      .from('assets')
      .upload(storageKey, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

    if (uploadErr) throw createError({ statusCode: 500, message: uploadErr.message })

    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(storageKey)
    const storageUrl = urlData.publicUrl

    // Create a completed job record so job_outputs FK is satisfied
    const { data: combineJob, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        project_id: projectId,
        type: 'audio',
        status: 'completed',
        provider: 'internal',
        model: 'concat',
        input: { combine: true, scene_count: scenes.length },
        output_summary: { combined: true },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (jobErr) throw createError({ statusCode: 500, message: jobErr.message })

    await supabase.from('job_outputs').insert({
      job_id: combineJob.id,
      project_id: projectId,
      type: 'audio',
      label: 'voice_track',
      storage_url: storageUrl,
      storage_path: storageKey,
      mime_type: 'audio/mpeg',
      metadata: {
        combined: true,
        scene_count: scenes.length,
        scene_snapshot: scenes.map(s => ({ id: s.id, script_text: s.script_text })),
      },
    })

    return { url: storageUrl }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
