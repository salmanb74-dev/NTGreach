'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { broadcastConversationMeta } from '@/lib/support/realtime'
import type { ConversationItem, SupportCategory } from './types'
import { snapMinutes } from './types'

type Options = {
  conversation: ConversationItem | null
  onTitleChange: (id: string, title: string | null) => void
  onConversationPatch?: (
    id: string,
    patch: Partial<Pick<ConversationItem, 'support_category' | 'logged_minutes' | 'title'>>
  ) => void
  onError?: (message: string) => void
  /** Realtime title sync from other clients. */
  onExternalTitleUpdate?: (title: string) => void
}

export function useConversationEdits({
  conversation,
  onTitleChange,
  onConversationPatch,
  onError,
}: Options) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  useEffect(() => {
    if (!conversation) return
    setEditingTitle(false)
    setTitleDraft(conversation.title ?? '')
  }, [conversation?.id, conversation?.title])

  const commitTitle = useCallback(async () => {
    if (!conversation) return
    const next = titleDraft.trim()
    const prev = (conversation.title ?? '').trim()
    setEditingTitle(false)

    if (next === prev) {
      setTitleDraft(conversation.title ?? '')
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('support_conversations')
      .update({ title: next || null })
      .eq('id', conversation.id)

    if (updateError) {
      onError?.(updateError.message)
      setTitleDraft(conversation.title ?? '')
      return
    }

    onTitleChange(conversation.id, next || null)
    onConversationPatch?.(conversation.id, { title: next || null })
    void broadcastConversationMeta({
      id:    conversation.id,
      title: next || null,
    })
  }, [conversation, onConversationPatch, onError, onTitleChange, titleDraft])

  const saveConversationMeta = useCallback(
    async (patch: {
      support_category?: SupportCategory
      logged_minutes?: number
    }) => {
      if (!conversation || savingMeta) return

      const nextCategory = patch.support_category ?? conversation.support_category
      const nextMinutes = snapMinutes(
        patch.logged_minutes ?? conversation.logged_minutes
      )

      if (
        nextCategory === conversation.support_category &&
        nextMinutes === conversation.logged_minutes
      ) {
        return
      }

      setSavingMeta(true)
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('support_conversations')
        .update({
          support_category: nextCategory,
          logged_minutes:   nextMinutes,
        })
        .eq('id', conversation.id)

      setSavingMeta(false)

      if (updateError) {
        onError?.(updateError.message)
        return
      }

      onConversationPatch?.(conversation.id, {
        support_category: nextCategory,
        logged_minutes:   nextMinutes,
      })
      void broadcastConversationMeta({
        id:               conversation.id,
        support_category: nextCategory,
        logged_minutes:   nextMinutes,
      })
    },
    [conversation, onConversationPatch, onError, savingMeta]
  )

  return {
    editingTitle,
    setEditingTitle,
    titleDraft,
    setTitleDraft,
    savingMeta,
    commitTitle,
    saveConversationMeta,
  }
}
