import { randomUUID } from 'node:crypto'
import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'
import {
  buildUploadStoragePath,
  getSceneAssetRole,
  getUploadLabel,
  validateMediaUpload,
  type UploadMediaType,
} from '../../utils/mediaUpload'
import { transcodeVideoBufferToMp4 } from '../../utils/ffmpeg'
import { createSignedAssetUrl } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, message: 'multipart form data is required' })

  const field = (name: string) => form.find(part => part.name === name)
  const projectId = field('projectId')?.data.toString()
  const sceneId = field('sceneId')?.data.toString()
  const requestedType = field('type')?.data.toString()
  const filePart = field('file')

  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })
  if (!filePart?.data?.length) throw createError({ statusCode: 400, message: 'file is required' })

  let validated: ReturnType<typeof validateMediaUpload>
  try {
    validated = validateMediaUpload(requestedType, filePart.type, filePart.filename)
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Invalid upload',
    })
  }

  if ((validated.mediaType === 'image' || validated.mediaType === 'video') && !sceneId) {
    throw createError({ statusCode: 400, message: 'sceneId is required for scene media uploads' })
  }

  const supabase = await serverSupabaseClient(event)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  if (sceneId) {
    const { data: scene } = await supabase
      .from('scenes')
      .select('id')
      .eq('id', sceneId)
      .eq('project_id', projectId)
      .single()

    if (!scene) throw createError({ statusCode: 404, message: 'Scene not found' })
  }

  let uploadBuffer = filePart.data
  let storedMimeType = validated.mimeType
  let storedExtension = validated.extension

  if (validated.mediaType === 'video') {
    uploadBuffer = await transcodeVideoBufferToMp4(filePart.data, validated.extension)
    storedMimeType = 'video/mp4'
    storedExtension = 'mp4'
  }

  const storagePath = buildUploadStoragePath({
    projectId,
    mediaType: validated.mediaType,
    extension: storedExtension,
    sceneId,
    uniqueId: randomUUID(),
  })

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(storagePath, uploadBuffer, {
      contentType: storedMimeType,
      upsert: false,
    })

  if (uploadError) throw createError({ statusCode: 500, message: uploadError.message })

  const storageUrl = await createSignedAssetUrl(supabase, storagePath)

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      project_id: projectId,
      type: validated.mediaType,
      status: 'completed',
      provider: 'upload',
      model: 'user_upload',
      input: {
        upload: true,
        scene_id: sceneId ?? null,
        filename: validated.filename,
        mime_type: validated.mimeType,
        stored_mime_type: storedMimeType,
      },
      output_summary: {
        upload: true,
        scene_id: sceneId ?? null,
      },
      completed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (jobError) throw createError({ statusCode: 500, message: jobError.message })

  const label = getUploadLabel(validated.mediaType, sceneId)
  const { data: output, error: outputError } = await supabase
    .from('job_outputs')
    .insert({
      job_id: job.id,
      project_id: projectId,
      type: validated.mediaType,
      label,
      storage_url: null,
      storage_path: storagePath,
      mime_type: storedMimeType,
      metadata: {
        upload: true,
        original_filename: validated.filename,
        original_mime_type: validated.mimeType,
        scene_id: sceneId ?? null,
      },
    })
    .select('id')
    .single()

  if (outputError) throw createError({ statusCode: 500, message: outputError.message })

  if ((validated.mediaType === 'image' || validated.mediaType === 'video') && sceneId) {
    const { error: assetError } = await supabase
      .from('scene_assets')
      .insert({
        scene_id: sceneId,
        job_output_id: output.id,
        asset_type: validated.mediaType,
        role: getSceneAssetRole(validated.mediaType as Extract<UploadMediaType, 'image' | 'video'>),
      })

    if (assetError) throw createError({ statusCode: 500, message: assetError.message })
  }

  return {
    url: storageUrl,
    outputId: output.id,
    jobId: job.id,
    type: validated.mediaType,
    sceneId: sceneId ?? null,
  }
})
