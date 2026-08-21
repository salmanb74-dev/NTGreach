import type { ConversationItem } from '@/components/support/types'

export type BranchFilterValue = 'all' | 'none' | string

export type BranchOption = { id: string; name: string }

export function matchesBranchFilter(
  c: ConversationItem,
  filter: BranchFilterValue
) {
  if (filter === 'all') return true
  if (filter === 'none') return !c.branch_id
  return c.branch_id === filter
}

export function branchOptionsFor(conversations: ConversationItem[]) {
  const map = new Map<string, string>()
  let hasUnlabeled = false
  for (const c of conversations) {
    if (c.branch_id) {
      map.set(c.branch_id, c.branch_name?.trim() || c.branch_id)
    } else {
      hasUnlabeled = true
    }
  }
  return {
    hasUnlabeled,
    options: [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function branchFilterLabel(
  filter: BranchFilterValue,
  options: BranchOption[]
) {
  if (filter === 'all') return 'Filter by branch'
  if (filter === 'none') return 'Filtered: No branch'
  const name = options.find(b => b.id === filter)?.name
  return name ? `Filtered: ${name}` : 'Filtered: Branch'
}
