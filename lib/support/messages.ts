import type { SupportMessageRow } from '@/lib/support/realtime'
import type { ChatMessage } from '@/components/support/types'

export function formatSupportMsgTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function mapSupportRowToChatMessage(
  row: SupportMessageRow,
  senderName: string
): ChatMessage {
  return {
    id:              row.id,
    conversation_id: row.conversation_id,
    sender_id:       row.sender_id,
    sender_type:     row.sender_type,
    sender_name:     row.sender_display_name?.trim() || senderName,
    message_type:    row.message_type,
    content:         row.content,
    file_url:        row.file_url,
    created_at:      row.created_at,
    read_at:         row.read_at,
    expires_at:      row.expires_at ?? null,
  }
}

export function isMediaMessageType(type: ChatMessage['message_type']): boolean {
  return type === 'image' || type === 'voice' || type === 'video'
}
