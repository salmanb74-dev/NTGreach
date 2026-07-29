'use client'

import { useState } from 'react'
import type { SupportMessageRow } from '@/lib/support/realtime'
import {
  insertMediaMessage,
  prepareScreenshotForChat,
  refocusAppWindow,
  screenshotDisplayConstraints,
  screenshotStoragePath,
  uploadSupportFile,
} from '@/lib/support/upload'
import styles from './ScreenCapture.module.css'

interface Props {
  conversationId: string
  senderId:       string
  senderType:     'agent' | 'customer'
  disabled?:      boolean
  onSent:         (row: SupportMessageRow) => void
  onError?:       (message: string) => void
  onActiveChange?: (active: boolean) => void
}

type Phase = 'idle' | 'confirm' | 'capturing' | 'countdown' | 'sending'

const SWITCH_SECONDS = 3

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop())
}

async function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 2500) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (video.videoWidth > 0 && video.videoHeight > 0) return
    await new Promise(r => setTimeout(r, 30))
  }
  throw new Error('No frames from screen capture')
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

/** Open display picker, wait briefly so user can switch screen, grab one frame, stop. */
async function grabStillFromDisplay(
  onCountdown: (secondsLeft: number) => void
): Promise<Blob> {
  const stream = await navigator.mediaDevices.getDisplayMedia(screenshotDisplayConstraints())
  try {
    const track = stream.getVideoTracks()[0]
    if (!track) throw new Error('No video track')

    for (let left = SWITCH_SECONDS; left >= 1; left--) {
      onCountdown(left)
      await sleep(1000)
      if (track.readyState !== 'live') throw new DOMException('Aborted', 'AbortError')
    }
    onCountdown(0)

    const ImageCaptureCtor = (window as unknown as {
      ImageCapture?: new (track: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> }
    }).ImageCapture

    let bitmap: ImageBitmap | null = null
    if (typeof ImageCaptureCtor === 'function') {
      try {
        bitmap = await new ImageCaptureCtor(track).grabFrame()
      } catch {
        bitmap = null
      }
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not capture frame')

    if (bitmap) {
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
    } else {
      const video = document.createElement('video')
      video.playsInline = true
      video.muted = true
      video.srcObject = stream
      await video.play()
      await waitForVideoFrame(video)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      video.srcObject = null
    }

    stopStream(stream)
    refocusAppWindow()

    // PNG here so the only lossy step (if any) happens once, at upload time.
    const raw = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    if (!raw) throw new Error('Could not capture screenshot')
    return raw
  } catch (err) {
    stopStream(stream)
    refocusAppWindow()
    throw err
  }
}

export default function ScreenshotCapture({
  conversationId,
  senderId,
  senderType,
  disabled = false,
  onSent,
  onError,
  onActiveChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [countdown, setCountdown] = useState(SWITCH_SECONDS)

  function resetToIdle() {
    setPhase('idle')
    setCountdown(SWITCH_SECONDS)
    onActiveChange?.(false)
  }

  function reportError(msg: string) {
    onError?.(msg)
  }

  function openConfirm() {
    if (disabled || phase !== 'idle') return
    setPhase('confirm')
    onActiveChange?.(true)
  }

  async function captureAndSend() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      reportError('Screen capture not supported here')
      resetToIdle()
      return
    }

    setPhase('capturing')

    try {
      const raw = await grabStillFromDisplay((left) => {
        setCountdown(left)
        setPhase('countdown')
      })
      setPhase('sending')
      refocusAppWindow()

      const prepared = await prepareScreenshotForChat(raw)
      const path = screenshotStoragePath(conversationId, prepared.extension)
      const upload = await uploadSupportFile({
        path,
        file: prepared.blob,
        contentType: prepared.contentType,
      })

      if ('error' in upload) {
        reportError(upload.error)
        resetToIdle()
        return
      }

      const inserted = await insertMediaMessage({
        conversationId,
        senderId,
        senderType,
        messageType: 'image',
        fileUrl: upload.publicUrl,
      })

      if ('error' in inserted) {
        reportError(inserted.error)
        resetToIdle()
        return
      }

      onSent(inserted.row)
      resetToIdle()
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'AbortError') {
        resetToIdle()
        return
      }
      reportError(err instanceof Error ? err.message : 'Screenshot failed')
      resetToIdle()
    }
  }

  if (phase !== 'idle') {
    const busy = phase === 'capturing' || phase === 'countdown' || phase === 'sending'
    return (
      <div className={styles.overlay} role="dialog" aria-label="Screenshot">
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Screenshot</h3>
          {phase === 'countdown' ? (
            <p className={styles.panelBody}>
              Switch to the problem screen… <strong>{countdown || '!'}</strong>
            </p>
          ) : phase === 'sending' ? (
            <p className={styles.panelBody}>Sending…</p>
          ) : (
            <>
              <p className={styles.panelBody}>
                Pick a screen or this app. Then you have {SWITCH_SECONDS}s to open the problem view.
              </p>
              <p className={styles.panelNote}>
                Sends automatically — delete the message if you don’t want it.
              </p>
            </>
          )}
          <div className={styles.panelActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={resetToIdle}
              disabled={busy}
            >
              Cancel
            </button>
            {phase === 'confirm' && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void captureAndSend()}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={openConfirm}
        disabled={disabled}
        aria-label="Screenshot"
        title="Screenshot"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      </button>
    </div>
  )
}
