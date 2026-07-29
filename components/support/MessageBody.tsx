'use client'

import { useEffect, useState } from 'react'
import type { ChatMessage } from './types'
import { SCREEN_RETENTION_DAYS } from '@/lib/support/upload'
import styles from './MessageBody.module.css'

interface Props {
  message: ChatMessage
}

function isVideoExpired(message: ChatMessage) {
  if (message.message_type !== 'video') return false
  if (!message.file_url) return true
  if (!message.expires_at) return false
  return new Date(message.expires_at).getTime() <= Date.now()
}

export default function MessageBody({ message }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [imageZoomed, setImageZoomed] = useState(false)

  useEffect(() => {
    if (!lightboxUrl) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setLightboxUrl(null)
        setImageZoomed(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])

  if (message.message_type === 'voice' && message.file_url) {
    return (
      <audio
        className={styles.audioPlayer}
        controls
        src={message.file_url}
        preload="metadata"
      />
    )
  }

  if (message.message_type === 'video') {
    if (isVideoExpired(message)) {
      return (
        <div className={styles.expired}>
          <span className={styles.expiredTitle}>Screen recording expired</span>
          <span className={styles.expiredHint}>
            Recordings are removed after {SCREEN_RETENTION_DAYS} days to save space
          </span>
        </div>
      )
    }

    if (message.file_url) {
      return (
        <div className={styles.videoWrap}>
          <video
            className={styles.messageVideo}
            controls
            playsInline
            preload="metadata"
            src={message.file_url}
          />
          {message.expires_at && (
            <span className={styles.expiresNote}>
              Kept until{' '}
              {new Date(message.expires_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
      )
    }
  }

  if (message.message_type === 'image' && message.file_url) {
    return (
      <>
        <button
          type="button"
          className={styles.imageBtn}
          onClick={() => {
            setImageZoomed(false)
            setLightboxUrl(message.file_url)
          }}
          aria-label="View full image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.file_url}
            alt=""
            className={styles.messageImage}
          />
        </button>
        {lightboxUrl && (
          <div
            className={`${styles.imageLightbox} ${
              imageZoomed ? styles.imageLightboxZoomed : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={() => {
              setLightboxUrl(null)
              setImageZoomed(false)
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt=""
              className={`${styles.lightboxImage} ${
                imageZoomed ? styles.lightboxImageZoomed : ''
              }`}
              role="button"
              tabIndex={0}
              aria-label={imageZoomed ? 'Zoom image out' : 'Zoom image in'}
              title={imageZoomed ? 'Click to fit image' : 'Click to zoom image'}
              onClick={e => {
                e.stopPropagation()
                setImageZoomed(value => !value)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setImageZoomed(value => !value)
                }
              }}
            />
            <button
              type="button"
              className={styles.lightboxZoom}
              onClick={e => {
                e.stopPropagation()
                setImageZoomed(value => !value)
              }}
            >
              {imageZoomed ? 'Fit to screen' : 'Zoom to full size'}
            </button>
            <a
              href={lightboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.lightboxOpen}
              onClick={e => e.stopPropagation()}
            >
              Open full size
            </a>
          </div>
        )}
      </>
    )
  }

  return <p className={styles.bubbleText}>{message.content}</p>
}
