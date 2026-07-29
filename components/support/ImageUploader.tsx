'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupportMessageRow } from '@/lib/support/realtime'
import {
  compressImageForChat,
  imageStoragePath,
  insertMediaMessage,
  uploadSupportFile,
} from '@/lib/support/upload'
import styles from './ImageUploader.module.css'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

interface Props {
  conversationId: string
  senderId:       string
  senderType:     'agent' | 'customer'
  disabled?:      boolean
  onSent:         (row: SupportMessageRow) => void
  onError?:       (message: string) => void
  onActiveChange?: (active: boolean) => void
}

type Phase = 'idle' | 'camera' | 'preview' | 'uploading'

export default function ImageUploader({
  conversationId,
  senderId,
  senderType,
  disabled = false,
  onSent,
  onError,
  onActiveChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraFileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    blobRef.current = null
  }

  function resetToIdle() {
    stopCameraStream()
    revokePreview()
    setPhase('idle')
    if (galleryRef.current) galleryRef.current.value = ''
    if (cameraFileRef.current) cameraFileRef.current.value = ''
    onActiveChange?.(false)
  }

  /** Errors surface in the parent chat banner only — not beside the icons. */
  function reportError(msg: string) {
    onError?.(msg)
  }

  useEffect(() => {
    return () => {
      stopCameraStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'camera' || !streamRef.current || !videoRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => {})
  }, [phase])

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      reportError('Please choose an image file')
      return
    }

    if (file.size > MAX_BYTES) {
      reportError('Image must be 5MB or smaller')
      return
    }

    try {
      const compressed = await compressImageForChat(file)
      revokePreview()
      blobRef.current = compressed
      setPreviewUrl(URL.createObjectURL(compressed))
      setPhase('preview')
      onActiveChange?.(true)
    } catch {
      reportError('Could not process image')
    }
  }

  function openGallery() {
    if (disabled || phase !== 'idle') return
    galleryRef.current?.click()
  }

  /** Live webcam on desktop; native camera sheet on phones if live preview fails. */
  async function openCamera() {
    if (disabled || phase !== 'idle') return

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
        streamRef.current = stream
        setPhase('camera')
        onActiveChange?.(true)
        return
      } catch (err) {
        const isPhone =
          typeof navigator !== 'undefined' &&
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

        if (isPhone) {
          cameraFileRef.current?.click()
          return
        }

        const name = err instanceof DOMException ? err.name : ''
        let msg = 'Could not open camera'
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          msg =
            'Camera blocked — click the lock/camera icon in the address bar → allow Camera, then try again'
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = 'No camera found on this device'
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          msg = 'Camera is in use by another app — close it and try again'
        } else if (name === 'SecurityError') {
          msg = 'Camera needs a secure page (https or localhost)'
        }

        reportError(msg)
        return
      }
    }

    cameraFileRef.current?.click()
  }

  async function snapPhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    stopCameraStream()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })
    if (!blob) {
      reportError('Could not capture photo')
      resetToIdle()
      return
    }

    try {
      const compressed = await compressImageForChat(blob)
      revokePreview()
      blobRef.current = compressed
      setPreviewUrl(URL.createObjectURL(compressed))
      setPhase('preview')
      onActiveChange?.(true)
    } catch {
      reportError('Could not process photo')
      resetToIdle()
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void processFile(file)
    e.target.value = ''
  }

  async function sendImage() {
    const blob = blobRef.current
    if (!blob || phase === 'uploading') return

    setPhase('uploading')

    const path = imageStoragePath(conversationId)
    const upload = await uploadSupportFile({
      path,
      file: blob,
      contentType: 'image/jpeg',
    })

    if ('error' in upload) {
      reportError(upload.error)
      setPhase('preview')
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
      setPhase('preview')
      return
    }

    onSent(inserted.row)
    resetToIdle()
  }

  if (phase === 'camera') {
    return (
      <div className={styles.cameraOverlay} role="dialog" aria-label="Take photo">
        <div className={styles.cameraPanel}>
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            playsInline
            muted
            autoPlay
          />
          <div className={styles.cameraActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={resetToIdle}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.snapBtn}
              onClick={() => void snapPhoto()}
            >
              Capture
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'preview' || phase === 'uploading') {
    return (
      <div className={styles.wrap}>
        <div className={styles.previewBar}>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className={styles.thumb} />
          )}
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void sendImage()}
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
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        className={styles.hiddenInput}
        onChange={onFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={cameraFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={onFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className={styles.iconBtn}
        onClick={openGallery}
        disabled={disabled}
        aria-label="Attach image"
        title="Attach image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => void openCamera()}
        disabled={disabled}
        aria-label="Take photo"
        title="Take photo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
    </div>
  )
}
