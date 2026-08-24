export type OpsDocKind = 'folder' | 'file'

export type OpsEnumCategory = 'doc_category' | 'doc_subcategory'

export type OpsEnumeration = {
  id: string
  category: OpsEnumCategory | string
  value: string
  label: string
  sort_order: number
  is_active: boolean
}

export type OpsDoc = {
  id: string
  title: string
  url: string
  kind: OpsDocKind
  category_value: string
  subcategory_value: string
  description: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export const OPS_DOC_ENUM_CATEGORIES = [
  { key: 'doc_category', label: 'Doc categories' },
  { key: 'doc_subcategory', label: 'Doc subcategories' },
] as const
