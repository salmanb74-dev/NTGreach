'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLead, updateLead } from '@/lib/actions/leads'
import Button from '@/components/ui/Button'
import CityCombobox from '@/components/ui/CityCombobox'
import { PIPELINE_STAGES, STAGE_LABELS, type Lead, type PipelineStage, type LeadSource } from '@/lib/types'
import styles from './LeadForm.module.css'

interface LeadFormProps {
  lead?: Lead
  initialStage?: string
  companyTypes?: { value: string; label: string }[]
  leadSources?:  { value: string; label: string }[]
  cities?:       { value: string; label: string }[]
}

export default function LeadForm({ lead, initialStage, companyTypes = [], leadSources = [], cities = [] }: LeadFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    contact_name:    lead?.contact_name    ?? '',
    company_name:    lead?.company_name    ?? '',
    email:           lead?.email           ?? '',
    phone:           lead?.phone           ?? '',
    city:            lead?.city            ?? '',
    restaurant_type: lead?.restaurant_type ?? '',
    source:          lead?.source          ?? '',
    stage:           lead?.stage           ?? initialStage ?? 'new',
    notes:           lead?.notes           ?? '',
    address:         lead?.address         ?? '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.contact_name.trim() || !form.company_name.trim()) {
      setError('Contact name and company name are required.')
      return
    }

    startTransition(async () => {
      try {
        const payload = {
          contact_name:    form.contact_name.trim(),
          company_name:    form.company_name.trim(),
          email:           form.email.trim() || undefined,
          phone:           form.phone.trim() || undefined,
          city:            form.city.trim() || undefined,
          restaurant_type: form.restaurant_type || undefined,
          source:          (form.source as LeadSource) || undefined,
          stage:           form.stage as PipelineStage,
          notes:           form.notes.trim() || undefined,
          address:         form.address.trim() || undefined,
        }

        if (lead) {
          await updateLead(lead.id, payload)
          router.push(`/leads/${lead.id}`)
        } else {
          await createLead(payload)
        }
      } catch (err: any) {
        setError(err.message ?? 'Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label}>Contact Name *</label>
          <input className={styles.input} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Ahmed Tariq" required />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Company Name *</label>
          <input className={styles.input} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Spice Garden Restaurants" required />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input className={styles.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ahmed@spice.pk" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Phone</label>
          <input className={styles.input} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 321 1234567" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>City</label>
          <CityCombobox
            value={form.city}
            onChange={val => set('city', val)}
            cities={cities}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Company Type</label>
          <select className={styles.select} value={form.restaurant_type} onChange={e => set('restaurant_type', e.target.value)}>
            <option value="">Select type…</option>
            {companyTypes.map(t => <option key={t.value} value={t.label}>{t.label}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Pipeline Stage</label>
          <select className={styles.select} value={form.stage} onChange={e => set('stage', e.target.value)}>
            {PIPELINE_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Source</label>
          <select className={styles.select} value={form.source} onChange={e => set('source', e.target.value)}>
            <option value="">Select source…</option>
            {leadSources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Address</label>
        <textarea
          className={styles.textarea}
          value={form.address}
          onChange={e => set('address', e.target.value.slice(0, 300))}
          placeholder="Street address, area, landmark…"
          rows={2}
          maxLength={300}
        />
        <div className={styles.charCount}>{form.address.length}/300</div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Notes</label>
        <textarea
          className={styles.textarea}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Any context about this lead — number of branches, current setup, pain points…"
          rows={3}
        />
      </div>

      <div className={styles.footer}>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : lead ? 'Save Changes' : 'Create Lead'}
        </Button>
      </div>
    </form>
  )
}
