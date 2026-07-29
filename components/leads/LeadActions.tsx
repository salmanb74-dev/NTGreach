'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import EmailModal from '@/components/modals/EmailModal'
import WhatsAppModal from '@/components/modals/WhatsAppModal'
import CallModal from '@/components/modals/CallModal'
import SiteVisitModal from '@/components/modals/SiteVisitModal'
import DealValueModal from '@/components/modals/DealValueModal'
import EarlyExitModal from '@/components/modals/EarlyExitModal'
import Button from '@/components/ui/Button'
import { updateLead, deleteLead } from '@/lib/actions/leads'
import { PIPELINE_STAGES, STAGE_LABELS, type Lead, type PipelineStage } from '@/lib/types'
import styles from './LeadActions.module.css'
import EmailLogModal from '@/components/modals/EmailLogModal'

// Stages that require deal value capture
const DEAL_VALUE_STAGES = new Set<PipelineStage>([
  'proposal_sent', 'negotiation', 'closed_won', 'closed_lost'
])

type ModalType = 'email' | 'email_log' | 'whatsapp' | 'call' | 'visit' | null

interface LeadActionsProps {
  lead:          Lead
  inputCurrency?: string
}

export default function LeadActions({ lead, inputCurrency = 'PKR' }: LeadActionsProps) {
  const router = useRouter()
  const [modal,               setModal]               = useState<ModalType>(null)
  const [stage,               setStage]               = useState<PipelineStage>(lead.stage)
  const [stageLoading,        setStageLoading]        = useState(false)
  const [pendingStage,        setPendingStage]        = useState<PipelineStage | null>(null)
  const [pendingEarlyExit,    setPendingEarlyExit]    = useState(false)
  const [showDeleteConfirm,   setShowDeleteConfirm]   = useState(false)
  const [isPending,           startTransition]        = useTransition()

  async function handleStageChange(newStage: PipelineStage) {
    if (newStage === stage) return

    if (newStage === 'early_exit') {
      setPendingEarlyExit(true)
      return
    }

    if (DEAL_VALUE_STAGES.has(newStage)) {
      setPendingStage(newStage)
      return
    }

    setStageLoading(true)
    setStage(newStage)
    try {
      await updateLead(lead.id, { stage: newStage })
      router.refresh()
    } catch {
      setStage(lead.stage)
    } finally {
      setStageLoading(false)
    }
  }

  function handleDealSaved() {
    if (pendingStage) setStage(pendingStage)
    setPendingStage(null)
    router.refresh()
  }

  function handleModalSaved() {
    router.refresh()
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteLead(lead.id)
      router.push('/leads')
    })
  }

  return (
    <>
      {/* Stage selector */}
      <div className={styles.stageSection}>
        <label className={styles.stageLabel}>Stage</label>
        <select
          className={styles.stageSelect}
          value={stage}
          onChange={e => handleStageChange(e.target.value as PipelineStage)}
          disabled={stageLoading}
        >
          {PIPELINE_STAGES.map(s => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Action buttons */}
      <div className={styles.actionBtns}>
        <Button
          size="sm"
          className={styles.fullWidth}
          onClick={() => setModal('email')}
          disabled={!lead.email}
          title={!lead.email ? 'No email address on this lead' : undefined}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          Send Email
        </Button>

		<Button size="sm" variant="outline" className={styles.fullWidth} onClick={() => setModal('email_log')}>
		  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<rect width="20" height="16" x="2" y="4" rx="2"/>
			<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
		  </svg>
		  Log Email
		</Button>

        <Button size="sm" variant="outline" className={styles.fullWidth} onClick={() => setModal('whatsapp')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Log WhatsApp
        </Button>

        <Button size="sm" variant="outline" className={styles.fullWidth} onClick={() => setModal('call')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          Log Call
        </Button>

        <Button size="sm" variant="outline" className={styles.fullWidth} onClick={() => setModal('visit')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Log Site Visit
        </Button>

        <a href={`/contracts/new?lead=${lead.id}`} className={styles.contractBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Generate Contract
        </a>

        <a href={`/quotations/new?lead=${lead.id}`} className={styles.contractBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Generate Quotation
        </a>
      </div>

      {/* Delete */}
      <div className={styles.deleteSection}>
        {!showDeleteConfirm ? (
          <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
            Delete Lead
          </button>
        ) : (
          <div className={styles.deleteConfirm}>
            <span className={styles.deleteConfirmText}>Permanently delete this lead and all history?</span>
            <div className={styles.deleteConfirmBtns}>
              <button className={styles.deleteCancelBtn} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={isPending}>
                {isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'email' && lead.email && (
        <EmailModal
          leadId={lead.id}
          toEmail={lead.email}
          toName={lead.contact_name}
          onClose={() => setModal(null)}
          onSent={handleModalSaved}
        />
      )}

	{modal === 'email_log' && (
	  <EmailLogModal
		leadId={lead.id}
		leadName={lead.contact_name}
		onClose={() => setModal(null)}
		onSaved={handleModalSaved}
	  />
	)}

      {modal === 'whatsapp' && (
        <WhatsAppModal
          leadId={lead.id}
          leadName={lead.contact_name}
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}
      {modal === 'call' && (
        <CallModal
          leadId={lead.id}
          leadName={lead.contact_name}
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}
      {modal === 'visit' && (
        <SiteVisitModal
          leadId={lead.id}
          leadName={lead.contact_name}
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}
      {pendingStage && (
        <DealValueModal
          leadId={lead.id}
          leadName={lead.contact_name}
          newStage={pendingStage}
          existingSetupFee={lead.quoted_setup_fee}
          existingMrr={lead.quoted_mrr}
          currency={inputCurrency}
          onClose={() => setPendingStage(null)}
          onSaved={handleDealSaved}
        />
      )}
      {pendingEarlyExit && (
        <EarlyExitModal
          leadId={lead.id}
          leadName={lead.contact_name}
          onClose={() => setPendingEarlyExit(false)}
          onSaved={() => { setStage('early_exit'); router.refresh() }}
        />
      )}
    </>
  )
}
