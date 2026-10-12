import type { OpsNestProduct } from '@/lib/ops/product'

export type OpsReleaseNote = {
  id: string
  product: OpsNestProduct
  title: string
  version: string | null
  body_html: string
  is_published: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OpsReleaseNoteInput = {
  title: string
  version?: string | null
  body_html: string
  is_published: boolean
  published_at?: string | null
}
