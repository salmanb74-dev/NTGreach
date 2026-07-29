'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupportMessageRow } from '@/lib/support/realtime'
import {
  displayMediaConstraints,
  insertMediaMessage,
  refocusAppWindow,
  screenRecordingExpiresAt,
  SCREEN_MAX_BYTES,
  SCREEN_MAX_SECONDS,
  SCREEN_RETENTION_DAYS,
  SCREEN_VIDEO_BITS_PER_SECOND,
  SCREEN_WARN_SECONDS,
  uploadSupportFile,
  videoStoragePath,
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

type Phase = 'idle' | 'confirm' | 'countdown' | 'recording' | 'sending'

const SWITCH_SECONDS = 3

function pickVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

export default function ScreenRecorder({
  conversationId,
  senderId,
  senderType,
  disabled = false,
  onSent,
  onError,
  onActiveChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [countdown, setCountdown] = useState(SWITCH_SECONDS)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)
  const sendingRef = useRef(false)

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function resetToIdle() {
    cancelledRef.current = true
    clearTimer()
    stopStream()
    mediaRecorderRef.current = null
    chunksRef.current = []
    sendingRef.current = false
    setSeconds(0)
    setCountdown(SWITCH_SECONDS)
    setPhase('idle')
    onActiveChange?.(false)
  }

  function reportError(msg: string) {
    onError?.(msg)
  }

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      clearTimer()
      stopStream()
    }
  }, [])

  function openConfirm() {
    if (disabled || phase !== 'idle') return
    cancelledRef.current = false
    setPhase('confirm')
    onActiveChange?.(true)
  }

  function cancelRecording() {
    cancelledRef.current = true
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = () => {
        stopStream()
        clearTimer()
        chunksRef.current = []
        setPhase('idle')
        setSeconds(0)
        onActiveChange?.(false)
      }
      try {
        recorder.stop()
      } catch {
        resetToIdle()
      }
      return
    }
    resetToIdle()
  }

  async function uploadAndSend(blob: Blob) {
    if (sendingRef.current || cancelledRef.current) return
    sendingRef.current = true
    setPhase('sending')

    const path = videoStoragePath(conversationId)
    const upload = await uploadSupportFile({
      path,
      file: blob,
      contentType: blob.type || 'video/webm',
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
      messageType: 'video',
      fileUrl: upload.publicUrl,
      expiresAt: screenRecordingExpiresAt(),
    })

    if ('error' in inserted) {
      reportError(inserted.error)
      resetToIdle()
      return
    }

    onSent(inserted.row)
    resetToIdle()
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      reportError('Screen recording not supported here')
      resetToIdle()
      return
    }

    cancelledRef.current = false

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaConstraints())
      if (cancelledRef.current) {
        stream.getTracks().forEach(t => t.stop())
        resetToIdle()
        return
      }

      streamRef.current = stream
      const track = stream.getVideoTracks()[0]

      track?.addEventListener('ended', () => {
        const r = mediaRecorderRef.current
        if (r && r.state !== 'inactive') {
          r.stop()
          return
        }
        // Stopped during countdown (before recording began)
        resetToIdle()
      })

      // 3s to switch to the problem screen before recording starts
      setPhase('countdown')
      for (let left = SWITCH_SECONDS; left >= 1; left--) {
        if (cancelledRef.current) {
          stopStream()
          resetToIdle()
          return
        }
        if (track && track.readyState !== 'live') {
          resetToIdle()
          return
        }
        setCountdown(left)
        await sleep(1000)
      }
      if (cancelledRef.current) {
        stopStream()
        resetToIdle()
        return
      }
      if (track && track.readyState !== 'live') {
        resetToIdle()
        return
      }

      const mimeType = pickVideoMimeType()
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: SCREEN_VIDEO_BITS_PER_SECOND,
      }
      if (mimeType) options.mimeType = mimeType

      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, options)
      } catch {
        recorder = new MediaRecorder(stream)
      }

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stopStream()
        clearTimer()
        refocusAppWindow()

        if (cancelledRef.current) {
          chunksRef.current = []
          setPhase('idle')
          setSeconds(0)
          onActiveChange?.(false)
          return
        }

        const type = recorder.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size === 0) {
          reportError('Recording was empty')
          resetToIdle()
          return
        }
        if (blob.size > SCREEN_MAX_BYTES) {
          reportError('Recording too large')
          resetToIdle()
          return
        }

        void uploadAndSend(blob)
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setSeconds(0)
      setPhase('recording')
      onActiveChange?.(true)
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          const next = s + 1
          if (next >= SCREEN_MAX_SECONDS) {
            const r = mediaRecorderRef.current
            if (r && r.state !== 'inactive') r.stop()
          }
          return next
        })
      }, 1000)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'AbortError') {
        resetToIdle()
        return
      }
      reportError('Could not start recording')
      resetToIdle()
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }

  if (phase === 'confirm' || phase === 'countdown' || phase === 'sending') {
    return (
      <div className={styles.overlay} role="dialog" aria-label="Record screen">
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Record screen</h3>
          {phase === 'countdown' ? (
            <p className={styles.panelBody}>
              Switch to the problem screen… <strong>{countdown}</strong>
            </p>
          ) : phase === 'sending' ? (
            <p className={styles.panelBody}>Sending…</p>
          ) : (
            <ul className={styles.limits}>
              <li>Pick a screen or this app</li>
              <li>{SWITCH_SECONDS}s to open the problem view, then recording starts</li>
              <li>Max {SCREEN_MAX_SECONDS}s · deleted after {SCREEN_RETENTION_DAYS} days</li>
              <li>Stop with <strong>Stop Sharing</strong> (or Stop here)</li>
              <li>Sends automatically — delete if you don’t want it</li>
            </ul>
          )}
          <div className={styles.panelActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={resetToIdle}
              disabled={phase === 'sending'}
            >
              Cancel
            </button>
            {phase === 'confirm' && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void startRecording()}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'recording') {
    return (
      <div className={styles.wrap}>
        <div className={styles.recordingBar}>
          <span className={styles.recordingIndicator} aria-hidden="true" />
          <span
            className={`${styles.timer} ${
              seconds >= SCREEN_WARN_SECONDS ? styles.timerWarn : ''
            }`}
          >
            {formatDuration(seconds)}/{formatDuration(SCREEN_MAX_SECONDS)}
          </span>
          <span className={styles.hint}>or Stop Sharing</span>
          <button type="button" className={styles.stopBtn} onClick={stopRecording}>
            Stop
          </button>
          <button type="button" className={styles.cancelBtn} onClick={cancelRecording}>
            Cancel
          </button>
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
        aria-label="Record screen"
        title={`Record screen (max ${SCREEN_MAX_SECONDS}s)`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <circle cx="12" cy="10" r="3" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  )
}
