'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PipelineStage, LeadSource } from '@/lib/types'

export interface ImportRow {
  contact_name:    string
  company_name:    string
  email?:          string
  phone?:          string
  city?:           string
  restaurant_type?: string
  source?:         string
  stage?:          string
  notes?:          string
}

export interface ImportResult {
  inserted: number
  skipped:  number
  errors:   string[]
}

const VALID_STAGES = new Set([
  'new','contacted','demo_scheduled','proposal_sent',
  'negotiation','closed_won','closed_lost'
])

const VALID_SOURCES = new Set([
  'cold_call','cold_email','referral','linkedin',
  'website','event','import','other'
])

function normaliseStage(val?: string): PipelineStage {
  if (!val) return 'new'
  const s = val.toLowerCase().replace(/[\s-]/g, '_')
  return VALID_STAGES.has(s) ? s as PipelineStage : 'new'
}

function normaliseSource(val?: string): LeadSource {
  if (!val) return 'import'
  const s = val.toLowerCase().replace(/[\s-]/g, '_')
  return VALID_SOURCES.has(s) ? s as LeadSource : 'import'
}

export async function importLeads(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] }

  // Fetch existing emails + phones to skip exact duplicates
  const { data: existing } = await supabase
    .from('leads')
    .select('email, phone')

  const existingEmails = new Set(existing?.map(r => r.email?.toLowerCase()).filter(Boolean))
  const existingPhones = new Set(existing?.map(r => r.phone?.replace(/\s/g, '')).filter(Boolean))

  const toInsert: object[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header row

    if (!row.contact_name?.trim()) {
      result.errors.push(`Row ${rowNum}: missing Contact Name — skipped`)
      result.skipped++
      continue
    }
    if (!row.company_name?.trim()) {
      result.errors.push(`Row ${rowNum}: missing Company Name — skipped`)
      result.skipped++
      continue
    }

    // Duplicate check
    const emailLower = row.email?.toLowerCase().trim()
    const phoneClean = row.phone?.replace(/\s/g, '').trim()

    if (emailLower && existingEmails.has(emailLower)) {
      result.errors.push(`Row ${rowNum}: ${row.contact_name} — email already exists, skipped`)
      result.skipped++
      continue
    }
    if (phoneClean && existingPhones.has(phoneClean)) {
      result.errors.push(`Row ${rowNum}: ${row.contact_name} — phone already exists, skipped`)
      result.skipped++
      continue
    }

    toInsert.push({
      contact_name:    row.contact_name.trim(),
      company_name:    row.company_name.trim(),
      email:           emailLower || null,
      phone:           row.phone?.trim() || null,
      city:            row.city?.trim() || null,
      restaurant_type: row.restaurant_type?.trim() || null,
      source:          normaliseSource(row.source),
      stage:           normaliseStage(row.stage),
      notes:           row.notes?.trim() || null,
      created_by:      user!.id,
    })

    if (emailLower) existingEmails.add(emailLower)
    if (phoneClean) existingPhones.add(phoneClean)
  }

  if (toInsert.length > 0) {
    // Insert in batches of 50
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50)
      const { error } = await supabase.from('leads').insert(batch)
      if (error) {
        result.errors.push(`Batch insert error: ${error.message}`)
      } else {
        result.inserted += batch.length
      }
    }
  }

  revalidatePath('/leads')
  return result
}
