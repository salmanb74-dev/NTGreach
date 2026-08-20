'use client'

import { useRef, useState } from 'react'
import type { SupportMessageRow } from '@/lib/support/realtime'
import { FILE_MAX_BYTES, IMAGE_MAX_BYTES } from '@/lib/support/media-limits'
import {
  compressImageForChat,
  fileStoragePath,
  imageStoragePath,
  insertMediaMessage,
  uploadSupportFile,
} from '@/lib/support/upload'
import styles from './ImageUploader.module.css'

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

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}

function safeFileName(name: string) {
  const trimmed = name.trim() || 'attachment'
  return trimmed.slice(0, 120)
}

export default function FileUploader({
  conversationId,
  senderId,
  senderType,
  disabled = false,
  onSent,
  onError,
  onActiveChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  function reportError(msg: string) {
    onError?.(msg)
  }

  function resetToIdle() {
    setPhase('idle')
    if (inputRef.current) inputRef.current.value = ''
    onActiveChange?.(false)
  }

  async function processAndSend(file: File) {
    const isImage = file.type.startsWith('image/')
    const maxBytes = isImage ? IMAGE_MAX_BYTES : FILE_MAX_BYTES

    if (file.size <= 0) {
      reportError('File is empty')
      return
    }

    if (file.size > maxBytes) {
      reportError(
        isImage
          ? `Image must be ${formatMb(IMAGE_MAX_BYTES)} or smaller (before compression)`
          : `File must be ${formatMb(FILE_MAX_BYTES)} or smaller`
      )
      return
    }

    setPhase('uploading')
    onActiveChange?.(true)

    try {
      if (isImage) {
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
        return
      }

      const fileName = safeFileName(file.name)
      const path = fileStoragePath(conversationId, fileName)
      const upload = await uploadSupportFile({
        path,
        file,
        contentType: file.type || 'application/octet-stream',
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
        messageType: 'file',
        fileUrl: upload.publicUrl,
        content: fileName,
      })

      if ('error' in inserted) {
        reportError(inserted.error)
        resetToIdle()
        return
      }

      onSent(inserted.row)
      resetToIdle()
    } catch {
      reportError(isImage ? 'Could not process image' : 'Could not upload file')
      resetToIdle()
    }
  }

  function openPicker() {
    if (disabled || phase !== 'idle') return
    inputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void processAndSend(file)
    e.target.value = ''
  }

  const title =
    phase === 'uploading'
      ? 'Uploading…'
      : `Attach file (max ${formatMb(FILE_MAX_BYTES)}; images ${formatMb(IMAGE_MAX_BYTES)} original, then compressed)`

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        onChange={onFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className={styles.iconBtn}
        onClick={openPicker}
        disabled={disabled || phase === 'uploading'}
        aria-label="Attach file"
        title={title}
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
