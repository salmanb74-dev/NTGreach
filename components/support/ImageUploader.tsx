'use client'

import { useRef, useState } from 'react'
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

type Phase = 'idle' | 'uploading'

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
  const galleryRef = useRef<HTMLInputElement>(null)

  function reportError(msg: string) {
    onError?.(msg)
  }

  function resetToIdle() {
    setPhase('idle')
    if (galleryRef.current) galleryRef.current.value = ''
    onActiveChange?.(false)
  }

  async function processAndSend(file: File) {
    if (!file.type.startsWith('image/')) {
      reportError('Please choose an image file')
      return
    }

    if (file.size > MAX_BYTES) {
      reportError('Image must be 5MB or smaller')
      return
    }

    setPhase('uploading')
    onActiveChange?.(true)

    try {
      const compressed = await compressImageForChat(file)
      const path = imageStoragePath(conversationId)
      const upload = await uploadSupportFile({
        path,
        file: compressed,
        contentType: 'image/jpeg',
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
    } catch {
      reportError('Could not process image')
      resetToIdle()
    }
  }

  function openGallery() {
    if (disabled || phase !== 'idle') return
    galleryRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void processAndSend(file)
    e.target.value = ''
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
      <button
        type="button"
        className={styles.iconBtn}
        onClick={openGallery}
        disabled={disabled || phase === 'uploading'}
        aria-label="Attach image"
        title={phase === 'uploading' ? 'Uploading…' : 'Attach image'}
      >
        {phase === 'uploading' ? (
          <span aria-hidden="true">…</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>
    </div>
  )
}
