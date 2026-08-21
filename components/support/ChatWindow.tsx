'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type SupportMessageRow } from '@/lib/support/realtime'
import MessageDeleteModal from './MessageDeleteModal'
import ChatHeader from './ChatHeader'
import ChatMetaBar from './ChatMetaBar'
import ChatMessageList from './ChatMessageList'
import ChatComposer from './ChatComposer'
import { useChatMessages } from './useChatMessages'
import { useConversationEdits } from './useConversationEdits'
import { useSupportCoverage } from './useSupportCoverage'
import { useMessageDelete } from './useMessageDelete'
import type { ConversationItem } from './types'
import styles from './ChatWindow.module.css'

interface Props {
  conversation:     ConversationItem | null
  currentUserId:    string
  currentUserName:  string
  onTitleChange:    (id: string, title: string | null) => void
  onConversationPatch?: (
    id: string,
    patch: Partial<Pick<ConversationItem, 'support_category' | 'logged_minutes' | 'title'>>
  ) => void
  onDelete?:        (id: string) => void
  onOpenList?:       () => void
  onMessageActivity?: (conversationId: string, at: string) => void
  onComposerFocus?:  () => void
  deleting?:         boolean
}

export default function ChatWindow({
  conversation,
  currentUserId,
  currentUserName,
  onTitleChange,
  onConversationPatch,
  onDelete,
  onOpenList,
  onMessageActivity,
  onComposerFocus,
  deleting = false,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const setErrorRef = useRef<(message: string) => void>(() => {})
  const offlineMessage = useSupportCoverage()

  const {
    editingTitle,
    setEditingTitle,
    titleDraft,
    setTitleDraft,
    savingMeta,
    commitTitle,
    saveConversationMeta,
  } = useConversationEdits({
    conversation,
    onTitleChange,
    onConversationPatch,
    onError: message => setErrorRef.current(message),
  })

  const {
    messages,
    loading,
    error,
    setError,
    channelRef,
    nameCache,
    appendLocalMessage,
    removeMessage,
  } = useChatMessages({
    conversationId: conversation?.id ?? null,
    onMessageActivity,
    onTitleUpdate: setTitleDraft,
  })

  setErrorRef.current = setError

  const {
    pendingDelete,
    deleting: deletingMsg,
    requestDelete,
    confirmDelete,
    cancelDelete,
  } = useMessageDelete({
    channelRef,
    removeMessage,
    onError: setError,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendText(content: string): Promise<boolean> {
    if (!conversation) return false

    setError(null)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id:       currentUserId,
        sender_type:     'agent',
        message_type:    'text',
        content,
      })
      .select('*')
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to send message')
      return false
    }

    const row = data as SupportMessageRow
    nameCache.current[currentUserId] = currentUserName
    appendLocalMessage(row, currentUserName)
    return true
  }

  function handleMediaSent(row: SupportMessageRow) {
    nameCache.current[currentUserId] = currentUserName
    appendLocalMessage(row, currentUserName)
  }

  if (!conversation) {
    return (
      <div className={styles.window}>
        <ChatHeader
          conversation={null}
          editingTitle={false}
          titleDraft=""
          onOpenList={onOpenList}
          onTitleDraftChange={() => {}}
          onStartEditTitle={() => {}}
          onCancelEditTitle={() => {}}
          onCommitTitle={() => {}}
        />
      </div>
    )
  }

  return (
    <div className={styles.window}>
      <ChatHeader
        conversation={conversation}
        editingTitle={editingTitle}
        titleDraft={titleDraft}
        deleting={deleting}
        onOpenList={onOpenList}
        onTitleDraftChange={setTitleDraft}
        onStartEditTitle={() => {
          setTitleDraft(conversation.title ?? '')
          setEditingTitle(true)
        }}
        onCancelEditTitle={() => {
          setTitleDraft(conversation.title ?? '')
          setEditingTitle(false)
        }}
        onCommitTitle={() => void commitTitle()}
        onDelete={onDelete}
      />

      <ChatMetaBar
        conversation={conversation}
        savingMeta={savingMeta}
        onCategoryChange={category =>
          void saveConversationMeta({ support_category: category })
        }
        onMinutesChange={minutes =>
          void saveConversationMeta({ logged_minutes: minutes })
        }
      />

      {error && <p className={styles.error}>{error}</p>}
      {offlineMessage && (
        <p className={styles.offlineBanner} role="status">
          {offlineMessage}
        </p>
      )}

      <ChatMessageList
        messages={messages}
        loading={loading}
        currentUserId={currentUserId}
        bottomRef={bottomRef}
        onDeleteMessage={requestDelete}
      />

      <ChatComposer
        key={conversation.id}
        conversationId={conversation.id}
        currentUserId={currentUserId}
        closed={conversation.status === 'closed'}
        onError={setError}
        onSent={handleMediaSent}
        onSendText={handleSendText}
        onComposerFocus={onComposerFocus}
      />

      <MessageDeleteModal
        message={pendingDelete}
        deleting={deletingMsg}
        onConfirm={() => void confirmDelete()}
        onClose={cancelDelete}
      />
    </div>
  )
}
