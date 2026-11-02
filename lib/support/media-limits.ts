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

/** Max screen recording length (auto-stop). */
export const SCREEN_MAX_SECONDS = 5 * 60
/** UI warn threshold near the end of a recording. */
export const SCREEN_WARN_SECONDS = 5 * 60 - 30
export const SCREEN_RETENTION_DAYS = 7
/** Capture frame rate for screen recordings. */
export const SCREEN_CAPTURE_FPS = 24
/**
 * Target encode rates for MediaRecorder (~70 MB for a full 5 min clip at these rates).
 * Keep SCREEN_MAX_BYTES high enough for a full-length recording.
 */
export const SCREEN_VIDEO_BITS_PER_SECOND = 1_800_000
export const SCREEN_AUDIO_BITS_PER_SECOND = 96_000
/** Hard upload / API cap for screen recordings (keep Nest Multer in sync). */
export const SCREEN_MAX_BYTES = 80 * 1024 * 1024

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
