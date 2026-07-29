'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Lead } from '@/lib/types'
import StageBadge from '@/components/ui/StageBadge'
import { deleteLeads } from '@/lib/actions/deleteLeads'
import styles from './LeadsTable.module.css'

interface LeadsTableProps { leads: Lead[] }

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function LeadsTable({ leads }: LeadsTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const allSelected = leads.length > 0 && selected.size === leads.length
  const someSelected = selected.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map(l => l.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDeleteSelected() {
    startTransition(async () => {
      await deleteLeads(Array.from(selected))
      setSelected(new Set())
      setShowConfirm(false)
      router.refresh()
    })
  }

  if (leads.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div className={styles.emptyText}>No leads found</div>
        <div className={styles.emptyHint}>Try a different search or add a new lead</div>
      </div>
    )
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selected.size} selected</span>
          {!showConfirm ? (
            <button className={styles.bulkDelete} onClick={() => setShowConfirm(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3-3h6"/>
              </svg>
              Delete {selected.size} lead{selected.size !== 1 ? 's' : ''}
            </button>
          ) : (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>
                Permanently delete {selected.size} lead{selected.size !== 1 ? 's' : ''} and all their history?
              </span>
              <button className={styles.confirmCancel} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className={styles.confirmDelete} onClick={handleDeleteSelected} disabled={isPending}>
                {isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          )}
          <button className={styles.bulkClear} onClick={() => { setSelected(new Set()); setShowConfirm(false) }}>
            Clear selection
          </button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkCol}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Contact</th>
              <th>Company</th>
              <th className={styles.hideTablet}>City</th>
              <th>Stage</th>
              <th className={styles.hideTablet}>Source</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr
                key={lead.id}
                className={`${styles.row} ${selected.has(lead.id) ? styles.rowSelected : ''}`}
              >
                <td className={styles.checkCol} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(lead.id)}
                    onChange={() => toggleOne(lead.id)}
                    aria-label={`Select ${lead.contact_name}`}
                  />
                </td>
                <td>
                  <Link href={`/leads/${lead.id}`} className={styles.contactCell}>
                    <div className={styles.avatar}>{initials(lead.contact_name)}</div>
                    <div>
                      <div className={styles.contactName}>{lead.contact_name}</div>
                      {lead.phone && <div className={styles.contactSub}>{lead.phone}</div>}
                    </div>
                  </Link>
                </td>
                <td className={styles.company}>{lead.company_name}</td>
                <td className={`${styles.city} ${styles.hideTablet}`}>{lead.city ?? '—'}</td>
                <td><StageBadge stage={lead.stage} size="sm" /></td>
                <td className={`${styles.source} ${styles.hideTablet}`}>
                  {lead.source ? lead.source.replace(/_/g, ' ') : '—'}
                </td>
                <td className={styles.time}>{timeAgo(lead.created_at)}</td>
                <td>
                  <Link href={`/leads/${lead.id}`} className={styles.chevron} aria-label="View lead">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
