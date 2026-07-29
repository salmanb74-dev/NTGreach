'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import styles from './RepSelector.module.css'

interface User {
  id: string
  full_name: string | null
  email: string
}

interface Props {
  users:      User[]
  selectedId: string
  basePath?:  string  // defaults to /reports
}

export default function RepSelector({ users, selectedId, basePath = '/reports' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rep', e.target.value)
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.label}>Viewing:</label>
      <select className={styles.select} value={selectedId} onChange={handleChange}>
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.full_name ?? u.email}
          </option>
        ))}
      </select>
    </div>
  )
}
