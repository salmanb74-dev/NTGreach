'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTarget, updateTarget, deleteTarget } from '@/lib/actions/targets'
import type { Target } from '@/lib/types'
import styles from './ManageTargets.module.css'

interface User { id: string; full_name: string | null; email: string }

interface Props {
  users:         User[]
  targets:       Target[]
  selectedRepId: string
  currency:      string
}

const EMPTY_FORM = {
  label: '', start_date: '', end_date: '',
  leads_target: '', setup_fee_target: '', mrr_target: '', revenue_target: ''
}

export default function ManageTargets({ users, targets, selectedRepId, currency }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [repId, setRepId]       = useState(selectedRepId)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function startEdit(t: Target) {
    setEditId(t.id)
    setRepId(t.user_id)
    setForm({
      label:            t.label,
      start_date:       t.start_date,
      end_date:         t.end_date,
      leads_target:     t.leads_target?.toString()     ?? '',
      setup_fee_target: t.setup_fee_target?.toString() ?? '',
      mrr_target:       t.mrr_target?.toString()       ?? '',
      revenue_target:   t.revenue_target?.toString()   ?? '',
    })
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setRepId(selectedRepId)
  }

  function handleSave() {
    if (!form.label || !form.start_date || !form.end_date) return
    startTransition(async () => {
      const data = {
        user_id:          repId,
        label:            form.label,
        start_date:       form.start_date,
        end_date:         form.end_date,
        currency:         currency,
        leads_target:     form.leads_target     ? parseInt(form.leads_target)       : null,
        setup_fee_target: form.setup_fee_target ? parseFloat(form.setup_fee_target) : null,
        mrr_target:       form.mrr_target       ? parseFloat(form.mrr_target)       : null,
        revenue_target:   form.revenue_target   ? parseFloat(form.revenue_target)   : null,
      }
      if (editId) {
        await updateTarget(editId, data)
      } else {
        await createTarget(data)
      }
      handleCancel()
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTarget(id)
      setConfirmDelete(null)
      router.refresh()
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>Targets</div>
        {!showForm && (
          <button className={styles.addBtn} onClick={() => setShowForm(true)}>
            + New Target
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formTitle}>{editId ? 'Edit Target' : 'New Target'}</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Sales Rep *</label>
              <select className={styles.select} value={repId} onChange={e => setRepId(e.target.value)}>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Label * <span className={styles.hint}>(e.g. Q1 2025)</span></label>
              <input className={styles.input} value={form.label} onChange={e => set('label', e.target.value)} placeholder="Q1 2025" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Start Date *</label>
              <input type="date" className={styles.input} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>End Date *</label>
              <input type="date" className={styles.input} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className={styles.formSubtitle}>
            Targets — all amounts in <strong>{currency}</strong> (input currency)
          </div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Leads Closed</label>
              <input type="number" min="0" className={styles.input} value={form.leads_target} onChange={e => set('leads_target', e.target.value)} placeholder="10" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Setup Fees ({currency})</label>
              <input type="number" min="0" className={styles.input} value={form.setup_fee_target} onChange={e => set('setup_fee_target', e.target.value)} placeholder="500,000" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>MRR Added ({currency})</label>
              <input type="number" min="0" className={styles.input} value={form.mrr_target} onChange={e => set('mrr_target', e.target.value)} placeholder="100,000" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Total Revenue ({currency})</label>
              <input type="number" min="0" className={styles.input} value={form.revenue_target} onChange={e => set('revenue_target', e.target.value)} placeholder="800,000" />
            </div>
          </div>

          <div className={styles.formFooter}>
            <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={isPending || !form.label || !form.start_date || !form.end_date}
            >
              {isPending ? 'Saving…' : editId ? 'Update Target' : 'Create Target'}
            </button>
          </div>
        </div>
      )}

      {/* Existing targets */}
      {targets.length === 0 && !showForm && (
        <div className={styles.empty}>No targets yet. Click "+ New Target" to add one.</div>
      )}

      {targets.map(t => {
        const start = new Date(t.start_date)
        const end   = new Date(t.end_date)
        const now   = new Date()
        const isActive = now >= start && now <= end
        const user = users.find(u => u.id === t.user_id)

        return (
          <div key={t.id} className={`${styles.targetRow} ${isActive ? styles.activeRow : ''}`}>
            <div className={styles.targetInfo}>
              <div className={styles.targetLabel}>{t.label}</div>
              <div className={styles.targetMeta}>
                {user?.full_name ?? user?.email} ·{' '}
                {start.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                {' → '}
                {end.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                {' · '}<strong>{t.currency ?? currency}</strong>
              </div>
            </div>
            <div className={styles.targetNums}>
              {t.leads_target     && <span>{t.leads_target} leads</span>}
              {t.setup_fee_target && <span>{t.currency ?? currency} {t.setup_fee_target.toLocaleString()} setup</span>}
              {t.mrr_target       && <span>{t.currency ?? currency} {t.mrr_target.toLocaleString()} MRR</span>}
              {t.revenue_target   && <span>{t.currency ?? currency} {t.revenue_target.toLocaleString()} revenue</span>}
            </div>
            <div className={styles.targetActions}>
              {confirmDelete === t.id ? (
                <>
                  <span className={styles.confirmText}>Delete?</span>
                  <button className={styles.deleteConfirm} onClick={() => handleDelete(t.id)} disabled={isPending}>Yes</button>
                  <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>No</button>
                </>
              ) : (
                <>
                  <button className={styles.editBtn} onClick={() => startEdit(t)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => setConfirmDelete(t.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
