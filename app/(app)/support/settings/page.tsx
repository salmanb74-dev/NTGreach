import { redirect } from 'next/navigation'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsAdmin } from '@/lib/roles'
import {
  getSupportOfflineMessage,
} from '@/lib/actions/support-shifts'
import { DEFAULT_OFFLINE_MESSAGE } from '@/lib/support/shifts'
import OfflineMessageForm from '@/components/support/OfflineMessageForm'
import styles from './settings.module.css'

export default async function SupportSettingsPage() {
  const profile = await getCachedProfile()
  if (!isCsAdmin(profile)) redirect('/support/chats')

  const offlineMessage = await getSupportOfflineMessage()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Support settings</h2>
        <p className={styles.sub}>
          Configure how customers see support when no agent is on duty.
        </p>
      </div>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Offline hours message</h3>
        <p className={styles.cardBody}>
          Shown in chat when there is no active shift covering the current time.
        </p>
        <OfflineMessageForm
          initialValue={offlineMessage}
          defaultValue={DEFAULT_OFFLINE_MESSAGE}
        />
      </section>
    </div>
  )
}
