export type ChecklistListType = 'onboarding' | 'training'
export type ChecklistItemStatus = 'done' | 'not_required'
/**
 * pending = never answered, item existed when restaurant checklist was created
 * added_later = never answered, item was added to the template after this checklist
 */
export type ChecklistStatusValue = ChecklistItemStatus | 'pending' | 'added_later'

export const CHECKLIST_PRODUCT = 'resto' as const

export interface ChecklistItem {
  id: string
  product: string
  list_type: ChecklistListType
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChecklistRestaurant {
  id: string
  product: string
  name: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  /** Computed when listing — pending + added_later */
  pending_count?: number
  total_count?: number
}

export interface ChecklistLine {
  item_id: string
  list_type: ChecklistListType
  label: string
  sort_order: number
  status: ChecklistStatusValue
  item_created_at: string
}

export function isChecklistListType(value: string): value is ChecklistListType {
  return value === 'onboarding' || value === 'training'
}

export function isChecklistItemStatus(value: string): value is ChecklistItemStatus {
  return value === 'done' || value === 'not_required'
}

export function isOpenChecklistStatus(status: ChecklistStatusValue): boolean {
  return status === 'pending' || status === 'added_later'
}

/** Unanswered status based on when the template item was created vs the restaurant. */
export function unresolvedChecklistStatus(
  itemCreatedAt: string,
  restaurantCreatedAt: string
): 'pending' | 'added_later' {
  const itemAt = Date.parse(itemCreatedAt)
  const restAt = Date.parse(restaurantCreatedAt)
  if (!Number.isNaN(itemAt) && !Number.isNaN(restAt) && itemAt > restAt) {
    return 'added_later'
  }
  return 'pending'
}

export function listTypeLabel(type: ChecklistListType): string {
  return type === 'onboarding' ? 'Onboarding prerequisites' : 'Training topics'
}

export function statusLabel(status: ChecklistStatusValue): string {
  if (status === 'done') return 'Done'
  if (status === 'not_required') return 'Not required'
  if (status === 'added_later') return 'Added later'
  return 'To do'
}

export function countOpen(lines: ChecklistLine[]): number {
  return lines.filter(l => isOpenChecklistStatus(l.status)).length
}
