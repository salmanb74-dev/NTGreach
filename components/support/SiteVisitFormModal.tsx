'use client'

import { useMemo, useState, useTransition } from 'react'
import Modal from '@/components/modals/Modal'
import Button from '@/components/ui/Button'
import {
  createSiteVisit,
  updateSiteVisit,
} from '@/lib/actions/support-site-visits'
import {
  coerceDurationMinutes,
  durationOptions,
  formatDurationOption,
  toTimeInputValue,
  type SiteVisit,
  type SiteVisitCustomerOption,
  type SupportProduct,
} from '@/lib/support/site-visits'
import modalStyles from '@/components/modals/modals.module.css'
import styles from './SiteVisitFormModal.module.css'

type Mode = 'create' | 'edit'

interface Props {
  mode:       Mode
  product:    SupportProduct
  customers:  SiteVisitCustomerOption[]
  visit?:     SiteVisit | null
  onClose:    () => void
  onSaved:    (visit: SiteVisit) => void
}

function todayYmd() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nowHm() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SiteVisitFormModal({
  mode,
  product,
  customers,
  visit,
  onClose,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [visitDate, setVisitDate] = useState(visit?.visit_date ?? todayYmd())
  const [visitTime, setVisitTime] = useState(
    visit ? toTimeInputValue(visit.visit_time) : nowHm()
  )
  const [duration, setDuration] = useState(
    coerceDurationMinutes(visit?.duration_minutes ?? 60)
  )
  const [tenantId, setTenantId] = useState<string | null>(visit?.tenant_id ?? null)
  const [customerName, setCustomerName] = useState(visit?.customer_name ?? '')
  const [customerMode, setCustomerMode] = useState<'pick' | 'custom'>(
    visit && !visit.tenant_id ? 'custom' : 'pick'
  )
  const [customerQuery, setCustomerQuery] = useState('')
  const hasListSelection =
    customerMode === 'pick' && Boolean(customerName.trim()) && tenantId != null
  const [notes, setNotes] = useState(visit?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const filteredCustomers = useMemo(() => {
    if (hasListSelection) return []
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers.slice(0, 80)
    return customers
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 80)
  }, [customers, customerQuery, hasListSelection])

  function selectCustomer(option: SiteVisitCustomerOption) {
    setTenantId(option.tenant_id)
    setCustomerName(option.name)
    setCustomerMode('pick')
    setCustomerQuery('')
  }

  function clearListSelection() {
    setTenantId(null)
    setCustomerName('')
    setCustomerQuery('')
  }

  function useCustomName() {
    setTenantId(null)
    setCustomerMode('custom')
    if (!customerName.trim() && customerQuery.trim()) {
      setCustomerName(customerQuery.trim())
    }
  }

  function switchToPick() {
    setCustomerMode('pick')
    // Keep name only if it was a real list pick; otherwise start fresh search
    if (!tenantId) {
      setCustomerName('')
      setCustomerQuery('')
    }
  }

  function handleSave() {
    const name = customerName.trim()
    if (!name) {
      setError('Customer name is required')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        const payload = {
          product,
          visit_date:       visitDate,
          visit_time:       visitTime,
          duration_minutes: duration,
          tenant_id:        customerMode === 'pick' ? tenantId : null,
          customer_name:    name,
          notes,
        }
        const saved =
          mode === 'edit' && visit
            ? await updateSiteVisit(visit.id, payload)
            : await createSiteVisit(payload)
        onSaved(saved)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save visit')
      }
    })
  }

  return (
    <Modal
      title={mode === 'edit' ? 'Edit site visit' : 'Log site visit'}
      onClose={onClose}
      width={460}
    >
      <div className={modalStyles.form}>
        <div className={modalStyles.twoCol}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="sv-date">
              Date
            </label>
            <input
              id="sv-date"
              type="date"
              className={modalStyles.input}
              value={visitDate}
              onChange={e => setVisitDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="sv-time">
              Time
            </label>
            <input
              id="sv-time"
              type="time"
              className={modalStyles.input}
              value={visitTime}
              onChange={e => setVisitTime(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="sv-duration">
            Duration
          </label>
          <select
            id="sv-duration"
            className={modalStyles.select}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            disabled={pending}
          >
            {durationOptions().map(m => (
              <option key={m} value={m}>
                {formatDurationOption(m)}
              </option>
            ))}
          </select>
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label}>Customer</label>
          <div className={styles.customerToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${customerMode === 'pick' ? styles.toggleActive : ''}`}
              onClick={switchToPick}
              disabled={pending}
            >
              From list
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${customerMode === 'custom' ? styles.toggleActive : ''}`}
              onClick={useCustomName}
              disabled={pending}
            >
              Custom name
            </button>
          </div>

          {customerMode === 'pick' ? (
            hasListSelection ? (
              <div className={styles.selectedRow}>
                <span className={styles.selectedName}>{customerName}</span>
                <button
                  type="button"
                  className={styles.changeBtn}
                  onClick={clearListSelection}
                  disabled={pending}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  className={modalStyles.input}
                  value={customerQuery}
                  onChange={e => setCustomerQuery(e.target.value)}
                  placeholder="Search customers…"
                  disabled={pending}
                  aria-label="Search customers"
                  autoFocus
                />
                <ul className={styles.customerList} role="listbox">
                  {filteredCustomers.length === 0 && (
                    <li className={styles.customerEmpty}>
                      No matches. Use a custom name instead.
                    </li>
                  )}
                  {filteredCustomers.map(c => {
                    const key = c.tenant_id ?? c.name
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          role="option"
                          className={styles.customerOption}
                          onClick={() => selectCustomer(c)}
                          disabled={pending}
                        >
                          {c.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )
          ) : (
            <input
              type="text"
              className={modalStyles.input}
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value)
                setTenantId(null)
              }}
              placeholder="Customer name"
              disabled={pending}
              autoFocus
            />
          )}
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="sv-notes">
            Notes <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="sv-notes"
            className={modalStyles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was done on-site…"
            rows={3}
            disabled={pending}
          />
        </div>

        {error && <div className={modalStyles.error}>{error}</div>}

        <div className={modalStyles.footerSimple}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Log visit'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
