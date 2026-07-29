import { createClient } from '@/lib/supabase/server'
import {
  formatLoggedMinutes,
  mapConversationRow,
  type SupportCategory,
} from '@/components/support/types'
import SupportReportsClient from '@/components/support/SupportReportsClient'
import styles from './reports.module.css'

type CustomerMonthRow = {
  tenantId:            string
  tenantName:          string
  platformMinutes:     number
  operationalMinutes:  number
  chatCount:           number
}

function monthKeyKarachi(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year:  'numeric',
    month: '2-digit',
  }).format(new Date(iso))
}

function currentMonthKey() {
  return monthKeyKarachi(new Date().toISOString())
}

function parseMonth(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value
  return currentMonthKey()
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year:  'numeric',
    timeZone: 'UTC',
  })
}

export default async function SupportReportsPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const month = parseMonth(searchParams.month)
  const supabase = createClient()

  const { data } = await supabase
    .from('support_conversations')
    .select('id, tenant_id, tenant_name, created_at, support_category, logged_minutes')
    .order('tenant_name', { ascending: true })
    .limit(5000)

  const byTenant = new Map<string, CustomerMonthRow>()

  for (const raw of data ?? []) {
    const c = mapConversationRow(raw as Record<string, unknown>)
    if (monthKeyKarachi(c.created_at) !== month) continue
    if (c.logged_minutes <= 0) continue

    let row = byTenant.get(c.tenant_id)
    if (!row) {
      row = {
        tenantId:           c.tenant_id,
        tenantName:         c.tenant_name,
        platformMinutes:    0,
        operationalMinutes: 0,
        chatCount:          0,
      }
      byTenant.set(c.tenant_id, row)
    }

    row.chatCount += 1
    if ((c.support_category as SupportCategory) === 'operational') {
      row.operationalMinutes += c.logged_minutes
    } else {
      row.platformMinutes += c.logged_minutes
    }
  }

  const rows = [...byTenant.values()].sort((a, b) =>
    a.tenantName.localeCompare(b.tenantName)
  )

  const totalPlatform = rows.reduce((s, r) => s + r.platformMinutes, 0)
  const totalOperational = rows.reduce((s, r) => s + r.operationalMinutes, 0)

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>Support hours</h2>
          <p className={styles.sub}>
            Logged minutes by customer for {monthLabel(month)}. Chats count in
            the month they were opened; minutes follow the chat&apos;s current type.
          </p>
        </div>
        <SupportReportsClient month={month} />
      </div>

      <div className={styles.summary}>
        <span>
          <span className={styles.summaryStrong}>{formatLoggedMinutes(totalPlatform)}</span>{' '}
          platform
        </span>
        <span>
          <span className={styles.summaryStrong}>{formatLoggedMinutes(totalOperational)}</span>{' '}
          operational
        </span>
        <span>
          <span className={styles.summaryStrong}>{rows.length}</span>{' '}
          {rows.length === 1 ? 'customer' : 'customers'}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          No logged minutes for this month yet. Set type and minutes on a chat
          from Chats.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Platform</th>
                <th>Operational</th>
                <th>Total</th>
                <th>Chats</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const total = row.platformMinutes + row.operationalMinutes
                return (
                  <tr key={row.tenantId}>
                    <td>{row.tenantName}</td>
                    <td>{formatLoggedMinutes(row.platformMinutes)}</td>
                    <td>{formatLoggedMinutes(row.operationalMinutes)}</td>
                    <td>{formatLoggedMinutes(total)}</td>
                    <td>{row.chatCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
