'use client'

import { useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { broadcastDeleteMessage } from '@/lib/support/realtime'
import { deleteSupportMessage } from '@/lib/support/upload'
import type { ChatMessage } from './types'

type Options = {
  channelRef: React.RefObject<RealtimeChannel | null>
  removeMessage: (id: string) => void
  onError: (message: string) => void
}

export function useMessageDelete({
  channelRef,
  removeMessage,
  onError,
}: Options) {
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!pendingDelete || deleting) return

    setDeleting(true)
    const result = await deleteSupportMessage({ id: pendingDelete.id })

    if (result.error) {
      onError(result.error)
      setDeleting(false)
      return
    }

    removeMessage(pendingDelete.id)
    await broadcastDeleteMessage(channelRef.current, {
      id:              pendingDelete.id,
      conversation_id: pendingDelete.conversation_id,
    })
    setPendingDelete(null)
    setDeleting(false)
  }

  function cancelDelete() {
    if (!deleting) setPendingDelete(null)
  }

  return {
    pendingDelete,
    deleting,
    requestDelete: setPendingDelete,
    confirmDelete,
    cancelDelete,
  }
}
