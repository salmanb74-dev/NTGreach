'use client'

import type { ConversationItem } from './types'
import styles from './ChatWindow.module.css'

type Props = {
  conversation: ConversationItem | null
  editingTitle: boolean
  titleDraft: string
  deleting?: boolean
  onOpenList?: () => void
  onTitleDraftChange: (value: string) => void
  onStartEditTitle: () => void
  onCancelEditTitle: () => void
  onCommitTitle: () => void
  onDelete?: (id: string) => void
}

function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.menuBtn}
      onClick={onClick}
      aria-label="Open conversations"
      title="Conversations"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  )
}

export default function ChatHeader({
  conversation,
  editingTitle,
  titleDraft,
  deleting = false,
  onOpenList,
  onTitleDraftChange,
  onStartEditTitle,
  onCancelEditTitle,
  onCommitTitle,
  onDelete,
}: Props) {
  if (!conversation) {
    return (
      <header className={styles.header}>
        {onOpenList && <MenuButton onClick={onOpenList} />}
        <div className={styles.emptyHeaderText}>
          <p className={styles.emptyTitle}>Select a conversation</p>
          <p className={styles.emptyBody}>
            Customer chats will appear here when they message support.
          </p>
        </div>
      </header>
    )
  }

  return (
    <header className={styles.header}>
      {onOpenList && <MenuButton onClick={onOpenList} />}
      {editingTitle ? (
        <input
          className={styles.titleInput}
          value={titleDraft}
          onChange={e => onTitleDraftChange(e.target.value)}
          onBlur={onCommitTitle}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === 'Escape') {
              onCancelEditTitle()
            }
          }}
          autoFocus
          aria-label="Conversation title"
        />
      ) : (
        <button
          type="button"
          className={styles.titleBtn}
          onClick={onStartEditTitle}
          title="Click to rename"
        >
          {conversation.title?.trim() || 'New Chat'}
        </button>
      )}
      {conversation.status === 'closed' && (
        <span className={`${styles.statusBadge} ${styles.statusClosed}`}>
          closed
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          className={styles.headerDeleteBtn}
          title="Delete conversation"
          aria-label="Delete conversation"
          disabled={deleting}
          onClick={() => onDelete(conversation.id)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
          </svg>
        </button>
      )}
    </header>
  )
}
