'use client'

import ConfirmModal from '@/components/modals/ConfirmModal'
import type { ChatMessage } from './types'

type Props = {
  message: ChatMessage | null
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function MessageDeleteModal({
  message,
  deleting,
  onConfirm,
  onClose,
}: Props) {
  if (!message) return null

  return (
    <ConfirmModal
      title="Delete message?"
      message="This will remove the message for everyone in this chat. This cannot be undone."
      confirmLabel="Delete"
      danger
      loading={deleting}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
