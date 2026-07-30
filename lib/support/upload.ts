'use client'

import { createClient } from '@/lib/supabase/client'
import type { SupportMessageRow } from '@/lib/support/realtime'
import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_EDGE,
  SCREENSHOT_JPEG_QUALITY,
  SCREENSHOT_MAX_EDGE,
  SCREENSHOT_PNG_MAX_BYTES,
  SCREEN_MAX_BYTES,
  SCREEN_MAX_SECONDS,
  SCREEN_RETENTION_DAYS,
  SCREEN_VIDEO_BITS_PER_SECOND,
  SCREEN_WARN_SECONDS,
  SUPPORT_FILES_BUCKET,
  VOICE_BITS_PER_SECOND,
  VOICE_MAX_SECONDS,
  VOICE_WARN_SECONDS,
  screenRecordingExpiresAt,
} from '@/lib/support/media-limits'

export {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_EDGE,
  SCREENSHOT_JPEG_QUALITY,
  SCREENSHOT_MAX_EDGE,
  SCREENSHOT_PNG_MAX_BYTES,
  SCREEN_MAX_BYTES,
  SCREEN_MAX_SECONDS,
  SCREEN_RETENTION_DAYS,
  SCREEN_VIDEO_BITS_PER_SECOND,
  SCREEN_WARN_SECONDS,
  VOICE_BITS_PER_SECOND,
  VOICE_MAX_SECONDS,
  VOICE_WARN_SECONDS,
  screenRecordingExpiresAt,
}

const BUCKET = SUPPORT_FILES_BUCKET

export async function uploadSupportFile(opts: {
  path: string
  file: Blob | File
  contentType: string
}): Promise<{ publicUrl: string } | { error: string }> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(opts.path, opts.file, {
      contentType: opts.contentType,
      upsert: false,
    })

  if (error) {
    return { error: error.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(opts.path)
  return { publicUrl: data.publicUrl }
}

export async function insertMediaMessage(opts: {
  conversationId: string
  senderId: string
  senderType: 'agent' | 'customer'
  messageType: 'image' | 'voice' | 'video'
  fileUrl: string
  /** ISO timestamp — required for video (7-day retention). */
  expiresAt?: string | null
}): Promise<{ row: SupportMessageRow } | { error: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      conversation_id: opts.conversationId,
      sender_id:       opts.senderId,
      sender_type:     opts.senderType,
      message_type:    opts.messageType,
      content:         null,
      file_url:        opts.fileUrl,
      expires_at:      opts.expiresAt ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'Failed to send media message' }
  }

  return { row: data as SupportMessageRow }
}

export function voiceStoragePath(conversationId: string) {
  return `voice/${conversationId}/${Date.now()}.webm`
}

export function imageStoragePath(conversationId: string) {
  return `images/${conversationId}/${Date.now()}.jpg`
}

export function screenshotStoragePath(conversationId: string, extension: 'png' | 'jpg') {
  return `images/${conversationId}/${Date.now()}.${extension}`
}

export function videoStoragePath(conversationId: string) {
  return `video/${conversationId}/${Date.now()}.webm`
}

/** getDisplayMedia options — allow this app/window (needed for PWA) plus other screens. */
export function displayMediaConstraints(): DisplayMediaStreamOptions {
  return {
    video: {
      frameRate: { ideal: 15, max: 24 },
      width:     { ideal: 1280, max: 1920 },
      height:    { ideal: 720,  max: 1080 },
    },
    audio: false,
    // Include this app so PWA / same-window POS capture works
    selfBrowserSurface: 'include',
    preferCurrentTab: false,
    surfaceSwitching: 'include',
  } as DisplayMediaStreamOptions
}

/**
 * Screenshot capture deliberately sets no width/height so the browser hands back
 * the surface at its native resolution — capping it at 720p is what made small
 * UI text unreadable. Frame rate stays low since only one frame is grabbed.
 */
export function screenshotDisplayConstraints(): DisplayMediaStreamOptions {
  return {
    video: {
      frameRate: { ideal: 5, max: 15 },
    },
    audio: false,
    selfBrowserSurface: 'include',
    preferCurrentTab: false,
    surfaceSwitching: 'include',
  } as DisplayMediaStreamOptions
}

/** Bring Support back to the front after capture (best-effort; browsers may block). */
export function refocusAppWindow() {
  if (typeof window === 'undefined') return
  try {
    window.focus()
  } catch {
    // ignore
  }
}

/** Extract storage object path from a public URL. */
export function storagePathFromPublicUrl(fileUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(fileUrl.slice(idx + marker.length).split('?')[0])
}

/** Delete own message and its media through the server-side admin API. */
export async function deleteSupportMessage(opts: {
  id: string
}): Promise<{ error?: string }> {
  try {
    const response = await fetch(`/api/support/messages/${encodeURIComponent(opts.id)}`, {
      method: 'DELETE',
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { error: result.error ?? 'Failed to delete message' }
    }
    return {}
  } catch {
    return { error: 'Failed to delete message' }
  }
}

/**
 * Downscale + convert to JPEG for chat (much smaller than phone camera PNGs).
 * GIFs become a still frame — intentional for storage size.
 */
export async function compressImageForChat(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not compress image')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', IMAGE_JPEG_QUALITY)
  })

  if (!blob) throw new Error('Could not compress image')
  return blob
}

/**
 * Screenshot equivalent of compressImageForChat: only downscales beyond
 * SCREENSHOT_MAX_EDGE and prefers PNG so text edges stay sharp. JPEG chroma
 * subsampling is what smears small type, so it is only a size fallback.
 */
export async function prepareScreenshotForChat(source: Blob): Promise<{
  blob: Blob
  contentType: string
  extension: 'png' | 'jpg'
}> {
  const bitmap = await createImageBitmap(source)
  const longEdge = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, SCREENSHOT_MAX_EDGE / longEdge)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not process screenshot')
  }

  ctx.imageSmoothingEnabled = scale < 1
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })

  if (png && png.size <= SCREENSHOT_PNG_MAX_BYTES) {
    return { blob: png, contentType: 'image/png', extension: 'png' }
  }

  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', SCREENSHOT_JPEG_QUALITY)
  })

  if (jpeg) return { blob: jpeg, contentType: 'image/jpeg', extension: 'jpg' }
  if (png) return { blob: png, contentType: 'image/png', extension: 'png' }
  throw new Error('Could not process screenshot')
}
