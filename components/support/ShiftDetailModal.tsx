'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/modals/Modal'
import ConfirmModal from '@/components/modals/ConfirmModal'
import Button from '@/components/ui/Button'
import {
  deleteMatchingShifts,
  deleteShift,
  updateShift,
} from '@/lib/actions/support-shifts'
import {
  agentDisplayName,
  findOverlappingShifts,
  formatShiftDate,
  formatShiftTime,
  shiftTimePatternKey,
  type ShiftAgent,
  type ShiftItem,
} from '@/lib/support/shifts'
import modalStyles from '@/components/modals/modals.module.css'
import styles from './ShiftDetailModal.module.css'

interface Props {
  shift:     ShiftItem
  agents:    ShiftAgent[]
  allShifts: ShiftItem[]
  canManage: boolean
  onClose:   () => void
}

type MatchingScope = 'from_here' | 'all'

export default function ShiftDetailModal({
  shift,
  agents,
  allShifts,
  canManage,
  onClose,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [transferring, setTransferring] = useState(false)
  const [transferTo, setTransferTo] = useState(
    agents.find(a => a.id !== shift.agent_id)?.id ?? ''
  )
  const [confirmOne, setConfirmOne] = useState(false)
  const [matchingOpen, setMatchingOpen] = useState(false)
  const [matchingScope, setMatchingScope] = useState<MatchingScope>('from_here')
  const [error, setError] = useState<string | null>(null)

  const overlaps = useMemo(
    () => findOverlappingShifts(shift, allShifts),
    [shift, allShifts]
  )

  const pattern = useMemo(
    () => shiftTimePatternKey(shift.start_at, shift.end_at),
    [shift.start_at, shift.end_at]
  )

  const originStartMs = useMemo(
    () => new Date(shift.start_at).getTime(),
    [shift.start_at]
  )

  const matchingAll = useMemo(() => {
    if (shift.series_id) {
      return allShifts.filter(s => s.series_id === shift.series_id)
    }
    return allShifts.filter(
      s =>
        s.agent_id === shift.agent_id &&
        shiftTimePatternKey(s.start_at, s.end_at) === pattern
    )
  }, [shift, allShifts, pattern])

  const matchingFromHere = useMemo(
    () => matchingAll.filter(s => new Date(s.start_at).getTime() >= originStartMs),
    [matchingAll, originStartMs]
  )

  const matchingCountAll = matchingAll.length
  const matchingCountFromHere = matchingFromHere.length
  const selectedCount =
    matchingScope === 'from_here' ? matchingCountFromHere : matchingCountAll

  const showMatchingButton = matchingCountAll > 1

  function handleTransfer() {
    if (!transferTo || transferTo === shift.agent_id) return
    setError(null)
    startTransition(async () => {
      try {
        await updateShift(shift.id, transferTo)
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transfer failed')
      }
    })
  }

  function handleDeleteOne() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteShift(shift.id)
        router.refresh()
        setConfirmOne(false)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
        setConfirmOne(false)
      }
    })
  }

  function handleDeleteMatching() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteMatchingShifts(shift.id, matchingScope)
        router.refresh()
        setMatchingOpen(false)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  return (
    <>
      <Modal
        title="Shift details"
        onClose={pending ? () => {} : onClose}
        width={440}
      >
        <div className={styles.body}>
          <dl className={styles.meta}>
            <div>
              <dt>Agent</dt>
              <dd>{shift.agent_name}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatShiftDate(shift.start_at)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>
                {formatShiftTime(shift.start_at)} – {formatShiftTime(shift.end_at)}
              </dd>
            </div>
            {shift.series_id && (
              <div>
                <dt>Series</dt>
                <dd>
                  {matchingCountAll} linked shift{matchingCountAll === 1 ? '' : 's'}
                </dd>
              </div>
            )}
          </dl>

          {overlaps.length > 0 && (
            <div className={styles.overlapBox}>
              <p className={styles.overlapTitle}>
                Overlaps {overlaps.length} other shift{overlaps.length === 1 ? '' : 's'}
              </p>
              <ul className={styles.overlapList}>
                {overlaps.map(o => (
                  <li key={o.id}>
                    <strong>{o.agent_name}</strong>
                    <span>
                      {formatShiftDate(o.start_at)} · {formatShiftTime(o.start_at)}–{formatShiftTime(o.end_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canManage && (
            <>
              {!transferring ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={pending}
                  onClick={() => setTransferring(true)}
                >
                  Transfer shift
                </Button>
              ) : (
                <div className={styles.transferBox}>
                  <label className={modalStyles.label} htmlFor="transfer-agent">
                    Reassign to
                  </label>
                  <select
                    id="transfer-agent"
                    className={modalStyles.select}
                    value={transferTo}
                    onChange={e => setTransferTo(e.target.value)}
                    disabled={pending}
                  >
                    {agents
                      .filter(a => a.id !== shift.agent_id)
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {agentDisplayName(a)}
                        </option>
                      ))}
                  </select>
                  <div className={styles.transferActions}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setTransferring(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={pending || !transferTo}
                      onClick={handleTransfer}
                    >
                      {pending ? 'Transferring…' : 'Confirm transfer'}
                    </Button>
                  </div>
                </div>
              )}

              <div className={styles.deleteGroup}>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={pending}
                  onClick={() => setConfirmOne(true)}
                >
                  Delete this shift
                </Button>

                {showMatchingButton && (
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    disabled={pending}
                    onClick={() => {
                      setMatchingScope('from_here')
                      setMatchingOpen(true)
                    }}
                  >
                    Delete matching shifts…
                  </Button>
                )}
              </div>

              {matchingOpen && (
                <div className={styles.matchingBox}>
                  <p className={styles.matchingTitle}>
                    Delete matching hours for {shift.agent_name}
                    <span>
                      ({formatShiftTime(shift.start_at)} – {formatShiftTime(shift.end_at)})
                    </span>
                  </p>

                  <label className={styles.scopeOption}>
                    <input
                      type="radio"
                      name="matching-scope"
                      checked={matchingScope === 'from_here'}
                      onChange={() => setMatchingScope('from_here')}
                      disabled={pending}
                    />
                    <span>
                      <strong>This date and future</strong>
                      <em>
                        {matchingCountFromHere} shift
                        {matchingCountFromHere === 1 ? '' : 's'} from{' '}
                        {formatShiftDate(shift.start_at)} onward
                      </em>
                    </span>
                  </label>

                  <label className={styles.scopeOption}>
                    <input
                      type="radio"
                      name="matching-scope"
                      checked={matchingScope === 'all'}
                      onChange={() => setMatchingScope('all')}
                      disabled={pending}
                    />
                    <span>
                      <strong>All matching (past + future)</strong>
                      <em>
                        {matchingCountAll} shift
                        {matchingCountAll === 1 ? '' : 's'} with these hours
                      </em>
                    </span>
                  </label>

                  <div className={styles.transferActions}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setMatchingOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={pending || selectedCount === 0}
                      onClick={handleDeleteMatching}
                    >
                      {pending
                        ? 'Deleting…'
                        : `Delete ${selectedCount} shift${selectedCount === 1 ? '' : 's'}`}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={modalStyles.footerSimple}>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={pending}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {confirmOne && (
        <ConfirmModal
          title="Delete shift?"
          message={`Remove ${shift.agent_name}'s shift on ${formatShiftDate(shift.start_at)}?`}
          confirmLabel="Delete"
          danger
          loading={pending}
          onConfirm={handleDeleteOne}
          onClose={() => {
            if (!pending) setConfirmOne(false)
          }}
        />
      )}
    </>
  )
}
