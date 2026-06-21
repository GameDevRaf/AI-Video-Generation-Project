// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildUploadStoragePath,
  getSceneAssetRole,
  getUploadLabel,
  validateMediaUpload,
} from '../../../server/utils/mediaUpload'

describe('media upload helpers', () => {
  it('accepts supported image, audio, and video MIME types', () => {
    expect(validateMediaUpload('image', 'image/webp', 'scene.webp')).toMatchObject({
      mediaType: 'image',
      extension: 'webp',
      filename: 'scene.webp',
    })
    expect(validateMediaUpload('audio', 'audio/mpeg', 'voice.mp3')).toMatchObject({
      mediaType: 'audio',
      extension: 'mp3',
    })
    expect(validateMediaUpload('video', 'video/quicktime', 'clip.mov')).toMatchObject({
      mediaType: 'video',
      extension: 'mov',
    })
    expect(validateMediaUpload('video', 'video/x-matroska', 'clip.mkv')).toMatchObject({
      mediaType: 'video',
      extension: 'mkv',
    })
    expect(validateMediaUpload('video', 'video/matroska', 'clip.mkv')).toMatchObject({
      mediaType: 'video',
      extension: 'mkv',
    })
  })

  it('rejects unsupported media types and mismatched MIME types', () => {
    expect(() => validateMediaUpload('document', 'application/pdf', 'brief.pdf')).toThrow(
      'type must be image, audio, or video',
    )
    expect(() => validateMediaUpload('image', 'video/mp4', 'clip.mp4')).toThrow(
      'Unsupported image file type',
    )
  })

  it('uses scene labels for image and video uploads and project label for audio', () => {
    expect(getUploadLabel('image', 'scene-1')).toBe('scene_image_scene-1')
    expect(getUploadLabel('video', 'scene-2')).toBe('scene_video_scene-2')
    expect(getUploadLabel('audio')).toBe('voice_track')
  })

  it('maps scene media to the expected asset roles', () => {
    expect(getSceneAssetRole('image')).toBe('first_frame')
    expect(getSceneAssetRole('video')).toBe('generated_video')
  })

  it('builds storage paths in the existing assets bucket folder convention', () => {
    expect(buildUploadStoragePath({
      projectId: 'project-1',
      mediaType: 'image',
      sceneId: 'scene-1',
      extension: 'png',
      uniqueId: 'abc',
    })).toBe('project-1/images/scene-1_abc.png')

    expect(buildUploadStoragePath({
      projectId: 'project-1',
      mediaType: 'audio',
      extension: 'wav',
      uniqueId: 'def',
    })).toBe('project-1/audio/audio_def.wav')
  })
})
