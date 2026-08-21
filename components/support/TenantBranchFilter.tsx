'use client'

import { useEffect, useState } from 'react'
import {
  branchFilterLabel,
  type BranchFilterValue,
  type BranchOption,
} from '@/lib/support/branch-filter'
import styles from './TenantBranchFilter.module.css'

type Props = {
  tenantId: string
  tenantName: string
  value: BranchFilterValue
  options: BranchOption[]
  hasUnlabeled: boolean
  onChange: (value: BranchFilterValue) => void
}

export default function TenantBranchFilter({
  tenantId,
  tenantName,
  value,
  options,
  hasUnlabeled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest(`[data-branch-menu="${tenantId}"]`)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, tenantId])

  function pick(next: BranchFilterValue) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className={styles.wrap} data-branch-menu={tenantId}>
      <button
        type="button"
        className={`${styles.btn} ${value !== 'all' ? styles.btnActive : ''}`}
        title={branchFilterLabel(value, options)}
        aria-label={`Filter ${tenantName} by branch`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={e => {
          e.stopPropagation()
          setOpen(prev => !prev)
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16M7 12h10M10 19h4" />
        </svg>
        {value !== 'all' && <span className={styles.dot} aria-hidden="true" />}
      </button>
      {open && (
        <div className={styles.menu} role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={value === 'all'}
            className={`${styles.item} ${value === 'all' ? styles.itemActive : ''}`}
            onClick={() => pick('all')}
          >
            All branches
          </button>
          {hasUnlabeled && (
            <button
              type="button"
              role="option"
              aria-selected={value === 'none'}
              className={`${styles.item} ${value === 'none' ? styles.itemActive : ''}`}
              onClick={() => pick('none')}
            >
              No branch
            </button>
          )}
          {options.map(b => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={value === b.id}
              className={`${styles.item} ${value === b.id ? styles.itemActive : ''}`}
              onClick={() => pick(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
