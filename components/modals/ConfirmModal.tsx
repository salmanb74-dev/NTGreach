'use client'

import Modal from './Modal'
import Button from '@/components/ui/Button'
import styles from './modals.module.css'

interface ConfirmModalProps {
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  danger?:       boolean
  loading?:      boolean
  onConfirm:     () => void
  onClose:       () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={loading ? () => {} : onClose} width={400}>
      <div className={styles.confirmBody}>
        <p className={styles.confirmMessage}>{message}</p>
        <div className={styles.footerSimple}>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
