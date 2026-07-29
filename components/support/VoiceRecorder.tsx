'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupportMessageRow } from '@/lib/support/realtime'
import {
  insertMediaMessage,
  uploadSupportFile,
  voiceStoragePath,
  VOICE_BITS_PER_SECOND,
  VOICE_MAX_SECONDS,
  VOICE_WARN_SECONDS,
} from '@/lib/support/upload'
import styles from './VoiceRecorder.module.css'

interface Props {
  conversationId: string
  senderId:       string
  senderType:     'agent' | 'customer'
  disabled?:      boolean
  onSent:         (row: SupportMessageRow) => void
  onError?:       (message: string) => void
  onActiveChange?: (active: boolean) => void
}

type Phase = 'idle' | 'recording' | 'preview' | 'uploading'

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoiceRecorder({
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    blobRef.current = null
  }

  function resetToIdle() {
    clearTimer()
    stopStream()
    revokePreview()
    mediaRecorderRef.current = null
    chunksRef.current = []
    setSeconds(0)
    setPhase('idle')
    setLocalError(null)
    onActiveChange?.(false)
  }

  useEffect(() => {
    return () => {
      clearTimer()
      stopStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cancelRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = () => {
        stopStream()
        clearTimer()
        chunksRef.current = []
        blobRef.current = null
        setPhase('idle')
        setSeconds(0)
        setLocalError(null)
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

  async function startRecording() {
    if (disabled || phase !== 'idle') return
    setLocalError(null)

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'Voice recording is not supported in this browser'
      setLocalError(msg)
      onError?.(msg)
      return
    }

    try {
      // Mono + echo cancel keeps Opus speech files small
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount:      1,
          echoCancellation:  true,
          noiseSuppression:  true,
          autoGainControl:   true,
        },
      })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: VOICE_BITS_PER_SECOND,
      }
      if (mimeType) recorderOptions.mimeType = mimeType

      const recorder = new MediaRecorder(stream, recorderOptions)

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stopStream()
        clearTimer()
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setPhase('preview')
        onActiveChange?.(true)
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setSeconds(0)
      setPhase('recording')
      onActiveChange?.(true)
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          const next = s + 1
          if (next >= VOICE_MAX_SECONDS) {
            // Auto-stop at cap — keeps notes lightweight
            const r = mediaRecorderRef.current
            if (r && r.state !== 'inactive') r.stop()
          }
          return next
        })
      }, 1000)
    } catch {
      const msg = 'Microphone permission denied'
      setLocalError(msg)
      onError?.(msg)
      resetToIdle()
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }

  async function sendRecording() {
    if (!blobRef.current || phase === 'uploading') return
    setPhase('uploading')
    setLocalError(null)

    const path = voiceStoragePath(conversationId)
    const upload = await uploadSupportFile({
      path,
      file: blobRef.current,
      contentType: blobRef.current.type || 'audio/webm',
    })

    if ('error' in upload) {
      setLocalError(upload.error)
      onError?.(upload.error)
      setPhase('preview')
      return
    }

    const inserted = await insertMediaMessage({
      conversationId,
      senderId,
      senderType,
      messageType: 'voice',
      fileUrl: upload.publicUrl,
    })

    if ('error' in inserted) {
      setLocalError(inserted.error)
      onError?.(inserted.error)
      setPhase('preview')
      return
    }

    onSent(inserted.row)
    resetToIdle()
  }

  if (phase === 'recording') {
    return (
      <div className={styles.wrap}>
        <div className={styles.recordingBar}>
          <span className={styles.recordingIndicator} aria-hidden="true" />
          <span
            className={`${styles.timer} ${
              seconds >= VOICE_WARN_SECONDS ? styles.timerWarn : ''
            }`}
          >
            {formatDuration(seconds)}
            {seconds >= VOICE_MAX_SECONDS - 10 ? ' · max' : ''}
          </span>
          <button
            type="button"
            className={styles.stopBtn}
            onClick={stopRecording}
          >
            Stop
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={cancelRecording}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'preview' || phase === 'uploading') {
    return (
      <div className={styles.wrap}>
        <div className={styles.previewBar}>
          {previewUrl && (
            <audio
              className={styles.previewAudio}
              controls
              src={previewUrl}
              preload="metadata"
            />
          )}
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void sendRecording()}
            disabled={phase === 'uploading'}
          >
            {phase === 'uploading' ? '…' : 'Send'}
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={resetToIdle}
            disabled={phase === 'uploading'}
          >
            Cancel
          </button>
        </div>
        {localError && <p className={styles.error} title={localError}>{localError}</p>}
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => void startRecording()}
        disabled={disabled}
        aria-label="Record voice note"
        title="Voice note"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </svg>
      </button>
      {localError && <p className={styles.error} title={localError}>{localError}</p>}
    </div>
  )
}
