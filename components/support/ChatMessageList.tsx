'use client'

import MessageBody from './MessageBody'
import type { ChatMessage } from './types'
import {
  formatSupportMsgTime,
  isMediaMessageType,
} from '@/lib/support/messages'
import styles from './ChatWindow.module.css'

type Props = {
  messages: ChatMessage[]
  loading: boolean
  currentUserId: string
  bottomRef: React.RefObject<HTMLDivElement>
  onDeleteMessage: (msg: ChatMessage) => void
}

export default function ChatMessageList({
  messages,
  loading,
  currentUserId,
  bottomRef,
  onDeleteMessage,
}: Props) {
  return (
    <div className={styles.messages}>
      {loading && <p className={styles.loading}>Loading messages…</p>}
      {!loading && messages.length === 0 && (
        <p className={styles.loading}>No messages yet. Say hello.</p>
      )}
      {messages.map(msg => {
        const isAgent = msg.sender_type === 'agent'
        const isMine = msg.sender_id === currentUserId
        const mediaBubble = isMediaMessageType(msg.message_type)
        return (
          <div
            key={msg.id}
            className={`${styles.row} ${isAgent ? styles.rowAgent : styles.rowCustomer}`}
          >
            <div className={styles.bubbleWrap}>
              <div
                className={`${styles.bubble} ${isAgent ? styles.bubbleAgent : styles.bubbleCustomer} ${
                  mediaBubble ? styles.bubbleMedia : ''
                }`}
              >
                <MessageBody message={msg} />
              </div>
              {isMine && (
                <button
                  type="button"
                  className={styles.msgDeleteBtn}
                  title="Delete message"
                  aria-label="Delete message"
                  onClick={() => onDeleteMessage(msg)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                  </svg>
                </button>
              )}
            </div>
            <div className={styles.meta}>
              <span>{msg.sender_name}</span>
              <span>{formatSupportMsgTime(msg.created_at)}</span>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
