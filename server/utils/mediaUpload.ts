import type { OutputType, AssetRole } from '../../app/types/database.types'

export type UploadMediaType = Extract<OutputType, 'image' | 'audio' | 'video'>

export interface UploadValidationResult {
  mediaType: UploadMediaType
  mimeType: string
  extension: string
  filename: string
}

const ALLOWED_MIME_TYPES: Record<UploadMediaType, Set<string>> = {
  image: new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  audio: new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/matroska']),
}

const EXTENSIONS_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/matroska': 'mkv',
}

export function validateMediaUpload(
  mediaType: unknown,
  mimeType: unknown,
  filename: unknown,
): UploadValidationResult {
  if (mediaType !== 'image' && mediaType !== 'audio' && mediaType !== 'video') {
    throw new Error('type must be image, audio, or video')
  }

  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES[mediaType].has(mimeType)) {
    throw new Error(`Unsupported ${mediaType} file type`)
  }

  const safeFilename = typeof filename === 'string' && filename.trim()
    ? filename.trim()
    : `upload.${EXTENSIONS_BY_MIME[mimeType]}`

  return {
    mediaType,
    mimeType,
    extension: EXTENSIONS_BY_MIME[mimeType] ?? '',
    filename: safeFilename,
  }
}

export function getUploadLabel(mediaType: UploadMediaType, sceneId?: string): string {
  if (mediaType === 'image') return `scene_image_${sceneId}`
  if (mediaType === 'video') return `scene_video_${sceneId}`
  return 'voice_track'
}

export function getSceneAssetRole(mediaType: Extract<UploadMediaType, 'image' | 'video'>): AssetRole {
  return mediaType === 'image' ? 'first_frame' : 'generated_video'
}

export function buildUploadStoragePath(params: {
  projectId: string
  mediaType: UploadMediaType
  extension: string
  sceneId?: string
  uniqueId: string
}): string {
  const folder = params.mediaType === 'image'
    ? 'images'
    : params.mediaType === 'video'
      ? 'videos'
      : 'audio'
  const prefix = params.sceneId ?? params.mediaType
  return `${params.projectId}/${folder}/${prefix}_${params.uniqueId}.${params.extension}`
}
