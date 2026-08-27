import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

import { createSignedAssetUrl } from '../../utils/storage'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function signPath(
  supabase: Awaited<ReturnType<typeof serverSupabaseClient>>,
  value: unknown,
): Promise<string | null> {
  return typeof value === 'string' && value
    ? createSignedAssetUrl(supabase, value)
    : null
}

async function loadProjectAssetPaths(
  supabase: Awaited<ReturnType<typeof serverSupabaseClient>>,
  projectId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('job_outputs')
    .select('label, storage_path, created_at')
    .eq('project_id', projectId)
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })

  const paths = new Map<string, string>()
  for (const row of (data ?? []) as Array<{ label: string | null; storage_path: string | null }>) {
    if (row.label && row.storage_path && !paths.has(row.label)) {
      paths.set(row.label, row.storage_path)
    }
  }
  return paths
}

async function hydrateExport(
  supabase: Awaited<ReturnType<typeof serverSupabaseClient>>,
  row: JsonRecord,
  assetPaths: Map<string, string>,
): Promise<JsonRecord> {
  const outputUrl = await signPath(supabase, row.storage_path)
  const metadata = isRecord(row.metadata) ? row.metadata : null
  const storedManifest = metadata && isRecord(metadata.manifest) ? metadata.manifest : null

  if (!storedManifest) return { ...row, storage_url: outputUrl }

  const storedScenes = Array.isArray(storedManifest.scenes) ? storedManifest.scenes : []
  const scenes = await Promise.all(storedScenes.map(async (scene) => {
    if (!isRecord(scene)) return scene
    const sceneId = typeof scene.id === 'string' ? scene.id : ''
    const videoPath = typeof scene.video_path === 'string'
      ? scene.video_path
      : assetPaths.get(`scene_video_${sceneId}`) ?? null
    const imagePath = typeof scene.image_path === 'string'
      ? scene.image_path
      : assetPaths.get(`scene_image_${sceneId}`) ?? null
    const [videoUrl, imageUrl] = await Promise.all([
      signPath(supabase, videoPath),
      signPath(supabase, imagePath),
    ])
    const sanitizedScene = Object.fromEntries(
      Object.entries(scene).filter(([key]) => key !== 'video_url' && key !== 'image_url'),
    )
    return {
      ...sanitizedScene,
      video_path: videoPath,
      image_path: imagePath,
      video_url: videoUrl,
      image_url: imageUrl,
    }
  }))

  return {
    ...row,
    storage_url: outputUrl,
    metadata: {
      ...metadata,
      manifest: {
        ...storedManifest,
        output_url: outputUrl,
        scenes,
      },
    },
  }
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { projectId } = getQuery(event) as { projectId?: string }
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  const supabase = await serverSupabaseClient(event)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  const { data, error } = await supabase
    .from('exports')
    .select('*, jobs(status, output_summary)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })

  const assetPaths = data?.length ? await loadProjectAssetPaths(supabase, projectId) : new Map<string, string>()
  return Promise.all((data ?? []).map((row: JsonRecord) => hydrateExport(supabase, row, assetPaths)))
})
