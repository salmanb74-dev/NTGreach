'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import SiteVisitFormModal from '@/components/support/SiteVisitFormModal'
import {
  deleteSiteVisit,
  getSiteVisits,
} from '@/lib/actions/support-site-visits'
import {
  agentLabel,
  formatVisitDate,
  formatVisitDuration,
  formatVisitTime,
  monthLabel,
  totalMinutesLabel,
  type SiteVisit,
  type SiteVisitAgent,
  type SiteVisitCustomerOption,
  type SupportProduct,
} from '@/lib/support/site-visits'
import styles from './SiteVisitsClient.module.css'

interface Props {
  currentUserId:   string
  currentUserName: string
  canViewAll:      boolean
  canEditOthers:   boolean
  product:         SupportProduct
  agents:          SiteVisitAgent[]
  customers:       SiteVisitCustomerOption[]
  initialVisits:   SiteVisit[]
  initialMonth:    number
  initialYear:     number
}

export default function SiteVisitsClient({
  currentUserId,
  currentUserName,
  canViewAll,
  canEditOthers,
  product,
  agents,
  customers,
  initialVisits,
  initialMonth,
  initialYear,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [viewAgentId, setViewAgentId] = useState(currentUserId)
  const [visits, setVisits] = useState(initialVisits)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'create' | SiteVisit | null>(null)

  useEffect(() => {
    setVisits(initialVisits)
  }, [initialVisits])

  const viewAgentName = useMemo(() => {
    if (viewAgentId === currentUserId) return currentUserName
    const agent = agents.find(a => a.id === viewAgentId)
    return agent ? agentLabel(agent) : 'Agent'
  }, [viewAgentId, currentUserId, currentUserName, agents])

  const viewingSelf = viewAgentId === currentUserId
  const canMutateRow = (visit: SiteVisit) =>
    visit.agent_id === currentUserId || canEditOthers

  const totalLabel = useMemo(() => totalMinutesLabel(visits), [visits])

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setMonth(m)
    setYear(y)
    void loadVisits(viewAgentId, m, y)
  }

  async function loadVisits(agentId: string, m: number, y: number) {
    setLoading(true)
    setError(null)
    try {
      const next = await getSiteVisits(agentId, m, y, product)
      setVisits(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visits')
    } finally {
      setLoading(false)
    }
  }

  function handleAgentChange(agentId: string) {
    setViewAgentId(agentId)
    void loadVisits(agentId, month, year)
  }

  function handleSaved(saved: SiteVisit) {
    if (saved.agent_id === viewAgentId) {
      setVisits(prev => {
        const without = prev.filter(v => v.id !== saved.id)
        return [saved, ...without].sort((a, b) => {
          const dateCmp = b.visit_date.localeCompare(a.visit_date)
          if (dateCmp !== 0) return dateCmp
          return b.visit_time.localeCompare(a.visit_time)
        })
      })
    }
    router.refresh()
  }

  function handleDelete(visit: SiteVisit) {
    if (!canMutateRow(visit)) return
    if (!window.confirm(`Delete visit to ${visit.customer_name}?`)) return

    startTransition(async () => {
      try {
        await deleteSiteVisit(visit.id)
        setVisits(prev => prev.filter(v => v.id !== visit.id))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete visit')
      }
    })
  }

  return (
    <div className={styles.shell}>
      <section className={styles.header}>
        <div className={styles.headerCopy}>
          <h2 className={styles.title}>Site visits</h2>
          <p className={styles.sub}>
            Log on-site customer visits for payroll. Dates can be past or future.
          </p>
        </div>
        {viewingSelf && (
          <Button
            type="button"
            size="sm"
            onClick={() => setModal('create')}
            disabled={pending}
          >
            Log visit
          </Button>
        )}
      </section>

      <section className={styles.sheet}>
        <div className={styles.sheetToolbar}>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              disabled={loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 className={styles.monthTitle}>{monthLabel(year, month)}</h2>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              disabled={loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className={styles.sheetActions}>
            {canViewAll && (
              <select
                className={styles.agentSelect}
                value={viewAgentId}
                onChange={e => handleAgentChange(e.target.value)}
                aria-label="Select agent"
                disabled={loading}
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {agentLabel(a)}
                    {a.id === currentUserId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {!viewingSelf && (
          <p className={styles.viewingBanner}>
            Viewing visits for <strong>{viewAgentName}</strong>
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Duration</th>
                <th>Customer</th>
                <th>Notes</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className={styles.empty}>Loading…</td>
                </tr>
              )}
              {!loading && visits.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    No site visits for this month.
                  </td>
                </tr>
              )}
              {!loading &&
                visits.map(visit => (
                  <tr key={visit.id}>
                    <td>{formatVisitDate(visit.visit_date)}</td>
                    <td>{formatVisitTime(visit.visit_time)}</td>
                    <td>{formatVisitDuration(visit.duration_minutes)}</td>
                    <td>
                      <span className={styles.customerName}>
                        {visit.customer_name}
                      </span>
                      {!visit.tenant_id && (
                        <span className={styles.customBadge}>Custom</span>
                      )}
                    </td>
                    <td className={styles.notesCell}>{visit.notes || '—'}</td>
                    <td className={styles.actionsCell}>
                      {canMutateRow(visit) && (
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() => setModal(visit)}
                            disabled={pending}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => handleDelete(visit)}
                            disabled={pending}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
            {!loading && visits.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td colSpan={4}>{totalLabel}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {modal && (
        <SiteVisitFormModal
          mode={modal === 'create' ? 'create' : 'edit'}
          product={product}
          customers={customers}
          visit={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
