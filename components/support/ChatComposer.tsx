'use client'

import { useState } from 'react'
import type { SupportMessageRow } from '@/lib/support/realtime'
import Button from '@/components/ui/Button'
import FileUploader from './FileUploader'
import ScreenshotCapture from './ScreenshotCapture'
import ScreenRecorder from './ScreenRecorder'
import VoiceRecorder from './VoiceRecorder'
import styles from './ChatWindow.module.css'

type Props = {
  conversationId: string
  currentUserId: string
  closed: boolean
  onError: (message: string) => void
  onSent: (row: SupportMessageRow) => void
  onSendText: (content: string) => Promise<boolean>
}

export default function ChatComposer({
  conversationId,
  currentUserId,
  closed,
  onError,
  onSent,
  onSendText,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [fileActive, setFileActive] = useState(false)
  const [shotActive, setShotActive] = useState(false)
  const [recActive, setRecActive] = useState(false)
  const mediaActive = voiceActive || fileActive || shotActive || recActive

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || sending || closed) return

    setSending(true)
    const content = draft.trim()
    const ok = await onSendText(content)
    setSending(false)
    if (ok) setDraft('')
  }

  function handleMediaSent(row: SupportMessageRow) {
    onSent(row)
  }

  const mediaProps = {
    conversationId,
    senderId: currentUserId,
    senderType: 'agent' as const,
    onError,
    onSent: handleMediaSent,
  }

  return (
    <form className={styles.composer} onSubmit={handleSend}>
      <FileUploader
        {...mediaProps}
        disabled={closed || voiceActive || shotActive || recActive}
        onActiveChange={setFileActive}
      />
      <ScreenshotCapture
        {...mediaProps}
        disabled={closed || voiceActive || fileActive || recActive}
        onActiveChange={setShotActive}
      />
      <VoiceRecorder
        {...mediaProps}
        disabled={closed || fileActive || shotActive || recActive}
        onActiveChange={setVoiceActive}
      />
      <ScreenRecorder
        {...mediaProps}
        disabled={closed || voiceActive || fileActive || shotActive}
        onActiveChange={setRecActive}
      />
      <input
        className={styles.input}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Type a message…"
        disabled={sending || mediaActive || closed}
        aria-label="Message"
      />
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={sending || mediaActive || !draft.trim() || closed}
      >
        {sending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  )
}
