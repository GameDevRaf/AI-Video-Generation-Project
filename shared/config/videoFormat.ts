// Single source of truth for the project's fixed output format — short-form vertical video.
// Hardcoded everywhere; there is no aspect ratio selector anywhere in the UI.
export const VIDEO_FORMAT = {
  aspectRatio: '9:16',
  maxDuration: 180,
  width: 1080,
  height: 1920,
} as const
