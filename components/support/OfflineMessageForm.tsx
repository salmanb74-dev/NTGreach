'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { updateSupportOfflineMessage } from '@/lib/actions/support-shifts'
import styles from './OfflineMessageForm.module.css'

interface Props {
  initialValue:  string
  defaultValue:  string
}

export default function OfflineMessageForm({ initialValue, defaultValue }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateSupportOfflineMessage(value)
        setSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setSaved(false)
        }}
        rows={3}
        disabled={pending}
        aria-label="Offline hours message"
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.reset}
          disabled={pending}
          onClick={() => {
            setValue(defaultValue)
            setSaved(false)
          }}
        >
          Reset to default
        </button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {saved && !error && <p className={styles.ok}>Saved</p>}
    </form>
  )
}
