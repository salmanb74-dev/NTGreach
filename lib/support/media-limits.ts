/** Shared media limits for Support chat (browser UI + Nest API). */

export const IMAGE_MAX_EDGE = 1280
export const IMAGE_JPEG_QUALITY = 0.72

export const VOICE_WARN_SECONDS = 120
export const VOICE_MAX_SECONDS = 5 * 60
export const VOICE_BITS_PER_SECOND = 24_000
/** Soft max for API uploads (~5 min @ 24kbps + overhead). */
export const VOICE_MAX_BYTES = 2 * 1024 * 1024

export const SCREENSHOT_MAX_EDGE = 2560
export const SCREENSHOT_PNG_MAX_BYTES = 3 * 1024 * 1024
export const SCREENSHOT_JPEG_QUALITY = 0.95

export const SCREEN_MAX_SECONDS = 30
export const SCREEN_WARN_SECONDS = 25
export const SCREEN_RETENTION_DAYS = 7
export const SCREEN_VIDEO_BITS_PER_SECOND = 1_000_000
/** ~30s @ 1Mbps + overhead. */
export const SCREEN_MAX_BYTES = 20 * 1024 * 1024

/** Max size of the image file the user picks (before compression). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Any non-image file attachment (PDF, audio, docs, etc.). */
export const FILE_MAX_BYTES = 3 * 1024 * 1024

export { SUPPORT_FILES_BUCKET } from './storage-path'

export function screenRecordingExpiresAt(from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + SCREEN_RETENTION_DAYS)
  return d.toISOString()
}
